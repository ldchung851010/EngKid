import * as THREE from 'three';
import { createActor } from 'xstate';
import { VoxelWorld } from './engine/renderer/VoxelWorld.js';
import { CameraController } from './engine/renderer/CameraController.js';
import { createVoxelCharacter } from './engine/renderer/CharacterFactory.js';
import { createTextSprite, disposeObject3D } from './engine/renderer/ScenePrimitives.js';
import { SceneLoader } from './engine/runtime/SceneLoader.js';
import { sessionMachine } from './engine/runtime/SessionMachine.js';
import type { SessionContext } from './engine/runtime/SessionMachine.js';
import { CollisionWorld } from './engine/runtime/CollisionWorld.js';
import { ScoreTracker } from './engine/scoring/ScoreTracker.js';
import { IntentRouter } from './engine/voice/IntentRouter.js';
import { SpeechPipeline } from './engine/voice/SpeechPipeline.js';
import { TTSEngine } from './engine/voice/TTSEngine.js';
import { MicButton } from './engine/voice/MicButton.js';
import type { NPCConfig, DialogueNode, SceneConfig } from './engine/schema/SceneConfig.js';
import { emptySceneHooks, type SceneHooks, type SceneModule } from './engine/runtime/SceneModule.js';
import type { FaceExpression } from './engine/renderer/CharacterFactory.js';
import { drawFaceExpression } from './engine/renderer/CharacterFactory.js';
import { CollectibleManager } from './engine/collectibles/index.js';

// ── Dynamic Scene ─────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const requestedSceneId = params.get('scene') || 'restaurant';
const sceneModules = import.meta.glob<SceneModule>('./scenes/*/index.ts', { eager: false, import: 'default' });
let activeSceneModule: SceneModule | null = null;
let activeSceneConfig: SceneConfig;
let activeSceneHooks: Required<SceneHooks> = emptySceneHooks;
let activeSceneId = 'restaurant';

async function loadSceneModule(): Promise<void> {
  const load = sceneModules[`./scenes/${requestedSceneId}/index.ts`] ?? sceneModules['./scenes/restaurant/index.ts'];
  if (!load) {
    throw new Error(`No scene module found for "${requestedSceneId}"`);
  }

  const module = await load();
  activeSceneModule = module;
  activeSceneId = module.id;
  activeSceneConfig = module.config;
  activeSceneHooks = { ...emptySceneHooks, ...module.hooks };
}

// ── Scene Setup ────────────────────────────────────────────────
const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 20, 60);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);

// ── Lighting ───────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(20, 30, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

// ── Engine Components ──────────────────────────────────────────
const world = new VoxelWorld(scene);
const controller = new CameraController(camera, renderer.domElement);
const collisionWorld = new CollisionWorld();
const PLAYER_COLLISION_RADIUS = 0.62;
const NPC_INTERACTION_RADIUS_PADDING = 1.25;
const COLLECTIBLE_INTERACTION_RADIUS = 3.25;
const tts = new TTSEngine();
const intentRouter = new IntentRouter('/api');
const scoreTracker = new ScoreTracker();

let currentNPCs: NPCConfig[] = [];
let npcMeshes: THREE.Group[] = [];
let sceneVisualGroup: THREE.Group | null = null;
type NPCStatus = 'alert' | 'thinking' | 'question' | null;
interface NPCStatusIndicator {
  sprite: THREE.Sprite;
  texture: THREE.CanvasTexture;
  material: THREE.SpriteMaterial;
  canvas: HTMLCanvasElement;
}
const npcStatusIndicators = new Map<string, NPCStatusIndicator>();

// NPC animation state
interface NPCAnimState {
  baseY: number;
  bobPhase: number;
  currentExpression: FaceExpression;
  /** 0-1 smoothed proximity factor */
  proximity: number;
}
const npcAnimStates = new Map<string, NPCAnimState>();
const NPC_AWARENESS_RADIUS = 10;
const NPC_HAPPY_RADIUS = 3;
const NPC_CURIOUS_RADIUS = 6;
let collectibleManager: CollectibleManager | null = null;
type InteractionTarget =
  | { type: 'npc'; npc: NPCConfig; distance: number }
  | { type: 'collectible'; word: string; distance: number }
  | { type: 'portal'; distance: number };
let activeInteractionTarget: InteractionTarget | null = null;
// ── Portal ────────────────────────────────────────────────────
let portalGroup: THREE.Group | null = null;
const PORTAL_INTERACTION_RADIUS = 2;

function createPortal(config: SceneConfig): THREE.Group {
  const group = new THREE.Group();
  const start = config.start ?? { position: { x: 0, y: 2.6, z: 0 }, lookAt: { x: 0, y: 2.3, z: 0 } };

  // Place portal behind spawn position (toward the back wall)
  const portalPos = {
    x: start.position.x,
    y: 2.4,
    z: start.position.z + 1.5,
  };
  group.position.set(portalPos.x, portalPos.y, portalPos.z);

  // Outer ring (torus)
  const ringGeo = new THREE.TorusGeometry(0.8, 0.12, 16, 32);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x7c4dff,
    roughness: 0.1,
    metalness: 0.8,
    emissive: 0x3d1a7a,
    emissiveIntensity: 0.6,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.castShadow = true;
  group.add(ring);

  // Inner surface (translucent disc)
  const innerGeo = new THREE.CircleGeometry(0.62, 32);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xb39ddb,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  group.add(inner);

  // Glow sprite behind portal
  const glowSprite = createTextSprite('', 128, 128, '#ffffff', 'bold 24px sans-serif');
  glowSprite.material.color.set(0xb39ddb);
  glowSprite.material.opacity = 0.5;
  glowSprite.material.depthTest = false;
  glowSprite.material.depthWrite = false;
  glowSprite.position.set(0, 0, -0.1);
  glowSprite.scale.set(2.2, 2.8, 1);
  group.add(glowSprite);

  // Label
  const label = createTextSprite('🚪 Home', 256, 64, '#ffffff', 'bold 28px sans-serif');
  label.position.set(0, 1.55, 0);
  label.scale.set(2.0, 0.5, 1);
  label.material.depthTest = false;
  label.material.depthWrite = false;
  group.add(label);

  // Floating particles (4 small spheres orbiting)
  const particleGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const particleMat = new THREE.MeshStandardMaterial({
    color: 0xb39ddb,
    roughness: 0.2,
    emissive: 0x7c4dff,
    emissiveIntensity: 0.8,
  });
  for (let i = 0; i < 4; i++) {
    const particle = new THREE.Mesh(particleGeo, particleMat);
    particle.userData = { portalOrbit: { angle: (Math.PI * 2 * i) / 4, radius: 0.7, speed: 1.2 } };
    group.add(particle);
  }

  return group;
}

function animatePortal(delta: number): void {
  if (!portalGroup) return;
  // Rotate the entire portal ring slowly
  portalGroup.rotation.y += delta * 0.6;
  // Animate orbiting particles
  portalGroup.children.forEach((child) => {
    const orbit = child.userData.portalOrbit;
    if (!orbit) return;
    orbit.angle += delta * orbit.speed;
    child.position.x = Math.cos(orbit.angle) * orbit.radius;
    child.position.y = Math.sin(orbit.angle * 1.3) * orbit.radius * 0.6;
    child.position.z = Math.sin(orbit.angle) * orbit.radius;
  });
}

function animateSceneVisuals(delta: number, elapsed: number): void {
  if (!sceneVisualGroup) return;
  activeSceneModule?.animateVisuals?.(sceneVisualGroup, delta, elapsed);
}

function getPortalDistance(): number {
  if (!portalGroup) return Infinity;
  const pp = portalGroup.position;
  const dx = camera.position.x - pp.x;
  const dz = camera.position.z - pp.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function navigateToHome(): void {
  location.href = '/';
}

// ── NPC Liveliness ──────────────────────────────────────────
function initNPCAnimState(npcId: string, baseY: number): void {
  npcAnimStates.set(npcId, {
    baseY,
    bobPhase: Math.random() * Math.PI * 2,
    currentExpression: 'idle',
    proximity: 0,
  });
}

function getNPCExpression(
  npcId: string,
  distance: number,
): FaceExpression {
  // During active dialogue, status indicator handles it; use 'talking'/'thinking'
  if (activeNPC?.id === npcId) {
    if (activeNodeId) return 'talking';
    return 'curious';
  }

  if (distance < NPC_HAPPY_RADIUS) return 'happy';
  if (distance < NPC_CURIOUS_RADIUS) return 'curious';
  return 'idle';
}

function animateNPCs(delta: number): void {
  const now = performance.now() * 0.001;

  for (const group of npcMeshes) {
    const npcId = group.userData.npcId as string;
    if (!npcId) continue;

    let state = npcAnimStates.get(npcId);
    if (!state) continue;

    const npcPos = group.position;
    const dx = camera.position.x - npcPos.x;
    const dz = camera.position.z - npcPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const awarenessFactor = Math.max(0, 1 - dist / NPC_AWARENESS_RADIUS);

    // Smooth proximity (for expression transitions)
    const targetProx = Math.max(0, 1 - dist / NPC_CURIOUS_RADIUS);
    state.proximity += (targetProx - state.proximity) * delta * 3;

    // ── Auto-face player ───────────────────────────────
    if (dist < NPC_AWARENESS_RADIUS && dist > 0.1) {
      const targetAngle = Math.atan2(dx, dz);
      // Normalize angle difference
      let diff = targetAngle - group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      group.rotation.y += diff * delta * 3.5;
    }

    // ── Idle bobbing ──────────────────────────────────
    const bobIntensity = 0.03 + awarenessFactor * 0.015;
    const bob = Math.sin(now * 1.8 + state.bobPhase) * bobIntensity;
    group.position.y = state.baseY + bob;

    // ── Look up/down toward camera ────────────────────
    if (awarenessFactor > 0.3) {
      const headTarget = group.children.find(
        (c) => c instanceof THREE.Sprite && c.userData.isFace,
      );
      if (headTarget) {
        const dy = camera.position.y - (npcPos.y + 1.55);
        const targetPitch = Math.atan2(dy, dist) * 0.3; // subtle
        const currentPitch = (headTarget as THREE.Sprite).userData.facePitch ?? 0;
        const newPitch = currentPitch + (targetPitch - currentPitch) * delta * 2;
        (headTarget as THREE.Sprite).userData.facePitch = newPitch;
        (headTarget as THREE.Sprite).position.y = 1.55 + newPitch * 0.3;
      }
    }

    // ── Face expression ───────────────────────────────
    const expression = getNPCExpression(npcId, dist);
    if (expression !== state.currentExpression) {
      state.currentExpression = expression;
      const canvas = group.userData.faceCanvas as HTMLCanvasElement | undefined;
      if (canvas) {
        drawFaceExpression(canvas, expression);
        // Notify texture update
        const faceSprite = group.children.find(
          (c): c is THREE.Sprite =>
            c instanceof THREE.Sprite && c.userData.isFace,
        );
        if (faceSprite?.material instanceof THREE.SpriteMaterial && faceSprite.material.map) {
          faceSprite.material.map.needsUpdate = true;
        }
      }
    }
  }
}

const interactionPrompt = document.getElementById('interaction-prompt')!;
const interactionLabel = document.getElementById('interaction-label')!;

// ── Session State Machine ──────────────────────────────────────
const actor = createActor(sessionMachine);
actor.start();

actor.subscribe((snapshot) => {
  console.log(`[session] → ${snapshot.value}`);
  updateScoreHUD();
});

function updateScoreHUD(): void {
  const hud = document.getElementById('score-hud')!;
  const score = scoreTracker.getSessionScore(activeSceneConfig.tasks.length);
  hud.textContent = `⭐ ${score.total} | ${score.completedCount}/${score.totalTasks}`;
}

// ── NPC Rendering ──────────────────────────────────────────────
function spawnNPCs(npcs: NPCConfig[]): void {
  // Clear old NPCs
  for (const group of npcMeshes) {
    scene.remove(group);
    disposeObject3D(group);
  }
  npcMeshes = [];
  npcStatusIndicators.clear();
  npcAnimStates.clear();

  for (const npc of npcs) {
    const group = createVoxelCharacter(npc);
    group.userData.npcId = npc.id;
    scene.add(group);
    npcMeshes.push(group);

    initNPCAnimState(npc.id, group.position.y);

    // Simple name label via sprite
    const labelSprite = createTextSprite(npc.name, 128, 40, '#ffffff', 'bold 18px sans-serif');
    labelSprite.position.set(0, 2.28, 0);
    labelSprite.scale.set(1.4, 0.42, 1);
    labelSprite.renderOrder = 900;
    labelSprite.material.depthTest = false;
    labelSprite.material.depthWrite = false;
    group.add(labelSprite);

    createNPCStatusIndicator(npc.id, group);
  }
}

function createNPCStatusIndicator(npcId: string, parent: THREE.Object3D): void {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  material.depthTest = false;
  material.depthWrite = false;
  const sprite = new THREE.Sprite(material);
  sprite.position.set(0, 2.78, 0);
  sprite.scale.set(0.75, 0.75, 1);
  sprite.renderOrder = 1000;
  sprite.visible = false;
  parent.add(sprite);
  npcStatusIndicators.set(npcId, { sprite, texture, material, canvas });
}

function setNPCStatus(npcId: string, status: NPCStatus): void {
  const indicator = npcStatusIndicators.get(npcId);
  if (!indicator) return;

  indicator.sprite.visible = status !== null;
  if (status === null) return;

  const ctx = indicator.canvas.getContext('2d')!;
  ctx.clearRect(0, 0, indicator.canvas.width, indicator.canvas.height);

  const styles: Record<Exclude<NPCStatus, null>, { text: string; fill: string; textColor: string; font: string }> = {
    alert: { text: '!', fill: '#ffd54f', textColor: '#332400', font: 'bold 58px sans-serif' },
    thinking: { text: '...', fill: '#ffffff', textColor: '#263238', font: 'bold 38px sans-serif' },
    question: { text: '?', fill: '#64b5f6', textColor: '#ffffff', font: 'bold 54px sans-serif' },
  };
  const style = styles[status];

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(48, 48, 34, 0, Math.PI * 2);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = style.textColor;
  ctx.font = style.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(style.text, 48, status === 'thinking' ? 42 : 50);
  indicator.texture.needsUpdate = true;
}

// ── Dialogue Flow ──────────────────────────────────────────────
let activeNodeId: string | null = null;
let activeNPC: NPCConfig | null = null;
let dialogueRetries = 0;
let dialogueRevision = 0;
const npcsAwaitingExit = new Set<string>();
const MAX_RETRIES = 3;

async function startDialogue(npcId: string, nodeId: string): Promise<void> {
  const npc = currentNPCs.find((n) => n.id === npcId);
  if (!npc) return;

  const node = findNode(npc, nodeId);
  if (!node) { console.log(`[Dialogue] ⚠️ node ${nodeId} not found`); return; }

  console.log(`[Dialogue] NPC ${npcId} → "${node.npcText.substring(0, 50)}..."`);
  // Hook gate check
  const ctx = actor.getSnapshot().context;
  if (!activeSceneHooks.onBeforeDialogue(npcId, nodeId, ctx)) return;

  activeNPC = npc;
  activeNodeId = nodeId;
  activeInteractionTarget = null;
  collectibleManager?.setActiveCollectible(null);
  dialogueRetries = 0;
  const revision = ++dialogueRevision;

  setNPCStatus(npcId, 'thinking');
  await speakNPC(node);

  if (!isCurrentDialogue(npcId, nodeId, revision)) return;
  if (!isNPCInRange(npc)) {
    endDialogue(npcId, false);
    return;
  }

  if (node.isTerminal || node.candidateIntents.length === 0) {
    endDialogue(npcId, true);
    return;
  }

  showMicWithHints(node);
}

function endDialogue(npcId: string, waitForExit: boolean): void {
  dialogueRevision++;
  micButton.hide();
  setNPCStatus(npcId, null);
  activeNodeId = null;
  activeNPC = null;
  activeInteractionTarget = null;

  if (waitForExit) {
    npcsAwaitingExit.add(npcId);
    saveProgress();
  }
}

async function saveProgress(): Promise<void> {
  const score = scoreTracker.getSessionScore(activeSceneConfig.tasks.length);
  const completed = score.completedCount === score.totalTasks;
  try {
    await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sceneId: activeSceneId, score: score.total, completed }),
    });
  } catch {
    console.warn('Failed to save progress');
  }
}

function isCurrentDialogue(npcId: string, nodeId: string, revision: number): boolean {
  return dialogueRevision === revision && activeNPC?.id === npcId && activeNodeId === nodeId;
}

function isNPCInRange(npc: NPCConfig): boolean {
  return getNPCDistance(npc) <= getNPCInteractionRadius(npc);
}

function getNPCInteractionRadius(npc: NPCConfig): number {
  return (npc.interaction.radius ?? 3) + NPC_INTERACTION_RADIUS_PADDING;
}

function getNPCDistance(npc: NPCConfig): number {
  const npcPos = new THREE.Vector3(npc.position.x + 0.5, 0, npc.position.z + 0.5);
  const dx = camera.position.x - npcPos.x;
  const dz = camera.position.z - npcPos.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function findNode(npc: NPCConfig, nodeId: string): DialogueNode | undefined {
  return npc.dialogueTree.find((n) => n.id === nodeId);
}

async function speakNPC(node: DialogueNode): Promise<void> {
  if (!activeNPC) return;

  const text = node.npcText.replace('{score}', String(scoreTracker.getSessionScore(activeSceneConfig.tasks.length).total));
  console.log(`[TTS] speaking as ${activeNPC.name} (${activeNPC.voice}, speed=${activeNPC.speechSpeed}): "${text.substring(0, 50)}..."`);
  await tts.speak(text, activeNPC.voice, activeNPC.speechSpeed);
}

// ── Mic & Speech Pipeline ──────────────────────────────────────
const micContainer = document.getElementById('mic-container')!;
const pipeline = new SpeechPipeline({
  onStateChange: (state) => console.log(`[pipeline] ${state}`),
  onTranscript: (text) => console.log(`[ASR] "${text}"`),
});

const micButton = new MicButton(micContainer, pipeline, async (transcript) => {
  await handleChildSpeech(transcript);
});

function showMicWithHints(node: DialogueNode): void {
  if (activeNPC) {
    setNPCStatus(activeNPC.id, 'question');
  }
  micButton.setHints(node.hintExamples);
  micButton.show();
}

// ── Intent Routing & Dialogue Progression ──────────────────────
async function handleChildSpeech(transcript: string): Promise<void> {
  if (!activeNPC || !activeNodeId) return;

  const npcId = activeNPC.id;
  const nodeId = activeNodeId;
  const revision = dialogueRevision;
  const node = findNode(activeNPC, activeNodeId);
  if (!node) return;

  // If terminal or no candidates, end dialogue
  if (node.isTerminal || node.candidateIntents.length === 0) {
    endDialogue(npcId, true);

    // Check if a task was completed
    const task = activeSceneConfig.tasks.find(
      (t) => t.trigger.type === 'dialogue_node' && t.trigger.npcId === npcId
    );
    if (task) {
      actor.send({ type: 'TASK_COMPLETE' });
      updateScoreHUD();
    }
    return;
  }

  setNPCStatus(npcId, 'thinking');

  const ctx = actor.getSnapshot().context;
  console.log(`[Dialogue] → IntentRouter with ${node.candidateIntents.length} candidates: [${node.candidateIntents.map(c => c.intentId).join(',')}]`);
  const result = await intentRouter.route(transcript, {
    name: activeNPC.name,
    role: activeNPC.role,
  }, node.candidateIntents, ctx.conversationHistory);

  if (!isCurrentDialogue(npcId, nodeId, revision)) return;

  console.log(`[Dialogue] ← intent: ${result.intentId} (confidence=${result.confidence})`);

  // Look up the task matching this intent and trigger it
  const task = activeSceneConfig.tasks.find((t) => t.targetIntent === result.intentId);
  if (task) {
    actor.send({ type: 'TASK_TRIGGERED', taskId: task.id });
  }

  if (result.intentId !== 'none') {
    // Matched! Advance dialogue
    const nextCandidate = node.candidateIntents.find((c) => c.intentId === result.intentId);
    const nextNodeId = nextCandidate?.nextNodeId ?? node.fallbackNodeId;
    actor.send({ type: 'INTENT_MATCHED', intentId: result.intentId, confidence: result.confidence });

    // Score
    const task = activeSceneConfig.tasks.find((t) => t.targetIntent === result.intentId);
    if (task) {
      scoreTracker.recordAttempt(task.id);
      const reward = activeSceneHooks.onIntentMatched(result.intentId, task.scoreReward, actor.getSnapshot().context);
      scoreTracker.completeTask(
        task.id,
        reward,
        result.confidence,
        false,
        transcript,
        activeSceneConfig.targetVocabulary
      );
      actor.send({ type: 'TASK_COMPLETE' });
      activeSceneHooks.onTaskComplete(task.id, actor.getSnapshot().context);
      updateScoreHUD();
    }

    if (nextNodeId) {
      console.log(`[Dialogue] advancing to node: ${nextNodeId}`);
      await startDialogue(npcId, nextNodeId);
    } else {
      endDialogue(npcId, true);
    }
  } else {
    // No match — retry or nudge
    dialogueRetries++;
    console.log(`[Dialogue] no match, retry ${dialogueRetries}/${MAX_RETRIES}`);
    actor.send({ type: 'INTENT_NONE' });

    if (dialogueRetries >= MAX_RETRIES) {
      actor.send({ type: 'INTENT_RETRY_EXHAUSTED' });
      // Fallback: advance to fallback node or demonstrate
      const fallbackId = node.fallbackNodeId;
      if (fallbackId) {
        await startDialogue(npcId, fallbackId);
      }
    } else {
      // Generate nudge
      const nudgeText = await intentRouter.generateNudge(
        transcript,
        { name: activeNPC.name, role: activeNPC.role },
        node.candidateIntents,
        ctx.conversationHistory
      );
      if (!isCurrentDialogue(npcId, nodeId, revision) || !activeNPC) return;

      setNPCStatus(npcId, 'thinking');
      try {
        await tts.speak(nudgeText, activeNPC.voice, activeNPC.speechSpeed);
      } catch { /* fallback if TTS fails */ }
      if (!isCurrentDialogue(npcId, nodeId, revision)) return;
      showMicWithHints(node);
    }
  }
}

// ── Interaction Targeting ──────────────────────────────────────
function showInteractionPrompt(target: InteractionTarget | null): void {
  if (!target || activeNPC) {
    interactionPrompt.style.display = 'none';
    return;
  }

  if (target.type === 'portal') {
    interactionLabel.textContent = 'Go home 🚪';
  } else if (target.type === 'npc') {
    interactionLabel.textContent = `Talk to ${target.npc.name}`;
  } else {
    interactionLabel.textContent = `Collect ${target.word}`;
  }
  interactionPrompt.style.display = 'flex';
}

function updateActiveDialogueRange(): void {
  if (activeNPC && !isNPCInRange(activeNPC)) {
    endDialogue(activeNPC.id, false);
  }
}

function getNearestNPCTarget(): InteractionTarget | null {
  let nearest: InteractionTarget | null = null;

  for (const npc of currentNPCs) {
    if (npc.interaction.type !== 'proximity') continue;
    const radius = getNPCInteractionRadius(npc);
    const dist = getNPCDistance(npc);

    if (dist > radius) {
      npcsAwaitingExit.delete(npc.id);
      continue;
    }

    if (npcsAwaitingExit.has(npc.id)) continue;
    if (!nearest || dist < nearest.distance) {
      nearest = { type: 'npc', npc, distance: dist };
    }
  }

  return nearest;
}

function updateInteractionTarget(): void {
  updateActiveDialogueRange();

  if (activeNPC) {
    activeInteractionTarget = null;
    collectibleManager?.setActiveCollectible(null);
    showInteractionPrompt(null);
    return;
  }

  const portalDist = getPortalDistance();
  const portalTarget: InteractionTarget | null =
    portalDist <= PORTAL_INTERACTION_RADIUS ? { type: 'portal', distance: portalDist } : null;

  const npcTarget = getNearestNPCTarget();
  const collectibleTarget = collectibleManager?.getNearestCollectible(camera.position, COLLECTIBLE_INTERACTION_RADIUS) ?? null;

  // Closest target wins (portal competes on distance)
  const candidates: InteractionTarget[] = [];
  if (npcTarget) candidates.push(npcTarget);
  if (collectibleTarget) candidates.push({ type: 'collectible', word: collectibleTarget.word, distance: collectibleTarget.distance });
  if (portalTarget) candidates.push(portalTarget);

  candidates.sort((a, b) => a.distance - b.distance);
  activeInteractionTarget = candidates[0] ?? null;

  for (const npc of currentNPCs) {
    setNPCStatus(npc.id, null);
  }

  collectibleManager?.setActiveCollectible(
    activeInteractionTarget?.type === 'collectible' ? activeInteractionTarget.word : null
  );
  showInteractionPrompt(activeInteractionTarget);
}

async function activateInteractionTarget(): Promise<void> {
  updateInteractionTarget();
  if (!activeInteractionTarget || activeNPC) return;

  if (activeInteractionTarget.type === 'portal') {
    navigateToHome();
    return;
  }

  if (activeInteractionTarget.type === 'collectible') {
    await collectibleManager?.openActiveCollectible();
    showInteractionPrompt(null);
    return;
  }

  const rootNode = activeInteractionTarget.npc.dialogueTree[0];
  if (rootNode) {
    await startDialogue(activeInteractionTarget.npc.id, rootNode.id);
  }
}

document.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyE' || event.repeat) return;
  void activateInteractionTarget();
});

// ── Scene Loading ──────────────────────────────────────────────
async function loadScene(): Promise<void> {
  // Validate config
  const errors = SceneLoader.validate(activeSceneConfig);
  if (errors.length > 0) {
    console.error('Scene config validation failed:', errors);
    return;
  }

  // Build voxel world
  const chunkData = SceneLoader.buildChunkData(activeSceneConfig);
  world.loadMap(chunkData);
  collisionWorld.clear();
  collisionWorld.loadChunk(chunkData);
  if (sceneVisualGroup) {
    scene.remove(sceneVisualGroup);
    disposeObject3D(sceneVisualGroup);
  }
  collectibleManager?.dispose();
  collectibleManager = null;
  activeInteractionTarget = null;
  showInteractionPrompt(null);
  sceneVisualGroup = activeSceneModule?.createVisuals?.() ?? null;
  if (sceneVisualGroup) {
    scene.add(sceneVisualGroup);
    collisionWorld.addObjectColliders(sceneVisualGroup);
  }
  controller.setCollisionTester((position) => collisionWorld.canOccupy(position, { radius: PLAYER_COLLISION_RADIUS }));

  // Spawn portal at entrance
  if (portalGroup) {
    scene.remove(portalGroup);
    disposeObject3D(portalGroup);
  }
  portalGroup = createPortal(activeSceneConfig);
  scene.add(portalGroup);

  // Spawn NPCs
  currentNPCs = activeSceneConfig.npcs;
  spawnNPCs(currentNPCs);
  collectibleManager = new CollectibleManager(scene, camera, tts, activeSceneId, activeSceneConfig);
  await collectibleManager.init();

  if (activeSceneConfig.environment) {
    const skyColor = activeSceneConfig.environment.skyColor ?? 0x87ceeb;
    const fogColor = activeSceneConfig.environment.fogColor ?? skyColor;
    scene.background = new THREE.Color(skyColor);
    scene.fog = new THREE.Fog(
      fogColor,
      activeSceneConfig.environment.fogNear ?? 20,
      activeSceneConfig.environment.fogFar ?? 60
    );
  }

  const start = activeSceneConfig.start ?? {
    position: { x: activeSceneConfig.map.width / 2, y: 2.6, z: activeSceneConfig.map.depth - 2 },
    lookAt: { x: activeSceneConfig.map.width / 2, y: 2.3, z: activeSceneConfig.map.depth / 2 },
  };
  camera.position.set(start.position.x, start.position.y, start.position.z);
  camera.lookAt(start.lookAt.x, start.lookAt.y, start.lookAt.z);

  // Start session
  actor.send({ type: 'LOAD_SCENE', sceneId: activeSceneId });
  actor.send({ type: 'ACTIVATE' });

  console.log(`[scene] ${activeSceneConfig.name} loaded`);
}

// ── Startup: Load TTS → Then Scene ───────────────────────────
const overlay = document.getElementById('loading-overlay')!;
const spinner = document.getElementById('loading-spinner')!;
const statusEl = document.getElementById('loading-status')!;
const errorEl = document.getElementById('loading-error')!;
let isSceneReady = false;

function hideLoadingOverlay(): void {
  if (!isSceneReady) return;
  overlay.style.display = 'none';
  errorEl.style.display = 'none';
}

tts.onStatusChange((s) => {
  statusEl.textContent = s.progress;
  if (s.state === 'error') {
    spinner.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.innerHTML = `
      <strong>TTS server failed to start</strong><br><br>
      Make sure <code>kitten-tts-server</code> is in <code>server/bin/</code>.
    `;
  }
  if (s.state === 'ready') {
    hideLoadingOverlay();
  }
});

(async () => {
  try {
    await tts.init();
    await loadSceneModule();
    statusEl.textContent = 'Building scene...';
    await loadScene();
    isSceneReady = true;
    hideLoadingOverlay();
  } catch (err) {
    console.error('Startup failed:', err);
  }
})();

// ── Render Loop ────────────────────────────────────────────────
const clock = new THREE.Clock();
let proximityTimer = 0;

function animate(): void {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1); // Cap delta
  controller.update(delta);

  // Resolve the single nearest interactive target every 500ms.
  proximityTimer += delta;
  if (proximityTimer > 0.5) {
    proximityTimer = 0;
    updateInteractionTarget();
  }

  collectibleManager?.update(delta);
  animatePortal(delta);
  animateNPCs(delta);
  animateSceneVisuals(delta, clock.elapsedTime);

  renderer.render(scene, camera);
}
animate();

// ── Resize Handler ─────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Export SceneEngine API ─────────────────────────────────────
export { world, tts, intentRouter, scoreTracker, actor as sessionActor };
