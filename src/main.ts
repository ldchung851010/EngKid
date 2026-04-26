import * as THREE from 'three';
import { createActor } from 'xstate';
import { VoxelWorld } from './engine/renderer/VoxelWorld.js';
import { CameraController } from './engine/renderer/CameraController.js';
import { createVoxelCharacter } from './engine/renderer/CharacterFactory.js';
import { createTextSprite, disposeObject3D } from './engine/renderer/ScenePrimitives.js';
import { SceneLoader } from './engine/runtime/SceneLoader.js';
import { sessionMachine } from './engine/runtime/SessionMachine.js';
import type { SessionContext } from './engine/runtime/SessionMachine.js';
import { ScoreTracker } from './engine/scoring/ScoreTracker.js';
import { IntentRouter } from './engine/voice/IntentRouter.js';
import { SpeechPipeline } from './engine/voice/SpeechPipeline.js';
import { TTSEngine } from './engine/voice/TTSEngine.js';
import { MicButton } from './engine/voice/MicButton.js';
import { restaurantConfig } from './scenes/restaurant/config.js';
import { restaurantHooks } from './scenes/restaurant/hooks.js';
import { createRestaurantDecor } from './scenes/restaurant/visuals.js';
import type { NPCConfig, DialogueNode, SceneConfig } from './engine/schema/SceneConfig.js';

// ── Dynamic Scene ─────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const sceneId = params.get('scene') || 'restaurant';
let activeSceneConfig: SceneConfig = restaurantConfig;
let activeSceneHooks: typeof restaurantHooks = restaurantHooks;

async function loadSceneConfig(): Promise<void> {
  if (sceneId === 'restaurant') return;
  const mod = await import(`./scenes/${sceneId}/config.ts`);
  const key = Object.keys(mod).find((k) => k.endsWith('Config')) || Object.keys(mod)[0];
  activeSceneConfig = mod[key] as SceneConfig;
  const hMod = await import(`./scenes/${sceneId}/hooks.ts`);
  const hKey = Object.keys(hMod)[0];
  activeSceneHooks = hMod[hKey] as typeof restaurantHooks;
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

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.5, 100);

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

// ── Session State Machine ──────────────────────────────────────
const actor = createActor(sessionMachine);
actor.start();

actor.subscribe((snapshot) => {
  console.log(`[session] → ${snapshot.value}`);
  updateScoreHUD();
});

function updateScoreHUD(): void {
  const hud = document.getElementById('score-hud')!;
  const score = scoreTracker.getSessionScore(restaurantConfig.tasks.length);
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

  for (const npc of npcs) {
    const group = createVoxelCharacter(npc);
    group.userData = { npcId: npc.id };
    scene.add(group);
    npcMeshes.push(group);

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
  if (!restaurantHooks.onBeforeDialogue(npcId, nodeId, ctx)) return;

  activeNPC = npc;
  activeNodeId = nodeId;
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
      body: JSON.stringify({ sceneId, score: score.total, completed }),
    });
    showBackButton();
  } catch {
    console.warn('Failed to save progress');
  }
}

function showBackButton(): void {
  if (document.getElementById('back-button')) return;
  const btn = document.createElement('div');
  btn.id = 'back-button';
  btn.innerHTML = '← Back to scenes';
  Object.assign(btn.style, {
    position: 'fixed', bottom: '24px', right: '24px',
    background: 'rgba(255,255,255,0.9)', color: '#333',
    padding: '12px 24px', borderRadius: '12px',
    fontSize: '16px', fontWeight: '700', cursor: 'pointer',
    zIndex: '100', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  });
  btn.addEventListener('click', () => { location.href = '/'; });
  document.body.appendChild(btn);
}

function isCurrentDialogue(npcId: string, nodeId: string, revision: number): boolean {
  return dialogueRevision === revision && activeNPC?.id === npcId && activeNodeId === nodeId;
}

function isNPCInRange(npc: NPCConfig): boolean {
  const radius = npc.interaction.radius ?? 3;
  const npcPos = new THREE.Vector3(npc.position.x + 0.5, 0, npc.position.z + 0.5);
  const dx = camera.position.x - npcPos.x;
  const dz = camera.position.z - npcPos.z;
  return Math.sqrt(dx * dx + dz * dz) <= radius;
}

function findNode(npc: NPCConfig, nodeId: string): DialogueNode | undefined {
  return npc.dialogueTree.find((n) => n.id === nodeId);
}

async function speakNPC(node: DialogueNode): Promise<void> {
  if (!activeNPC) return;

  const text = node.npcText.replace('{score}', String(scoreTracker.getSessionScore(restaurantConfig.tasks.length).total));
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
    const task = restaurantConfig.tasks.find(
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
  const task = restaurantConfig.tasks.find((t) => t.targetIntent === result.intentId);
  if (task) {
    actor.send({ type: 'TASK_TRIGGERED', taskId: task.id });
  }

  if (result.intentId !== 'none') {
    // Matched! Advance dialogue
    const nextCandidate = node.candidateIntents.find((c) => c.intentId === result.intentId);
    const nextNodeId = nextCandidate?.nextNodeId ?? node.fallbackNodeId;
    actor.send({ type: 'INTENT_MATCHED', intentId: result.intentId, confidence: result.confidence });

    // Score
    const task = restaurantConfig.tasks.find((t) => t.targetIntent === result.intentId);
    if (task) {
      scoreTracker.recordAttempt(task.id);
      scoreTracker.completeTask(
        task.id,
        task.scoreReward,
        result.confidence,
        false,
        transcript,
        restaurantConfig.targetVocabulary
      );
      actor.send({ type: 'TASK_COMPLETE' });
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
        scoreTracker.recordAttempt('order_food');
        const task = restaurantConfig.tasks.find((t) => t.id === 'order_food');
        if (task) {
          scoreTracker.completeTask(task.id, task.scoreReward, 0, true, transcript, restaurantConfig.targetVocabulary);
        }
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

// ── Proximity Detection ────────────────────────────────────────
function checkNPCProximity(): void {
  const camPos = camera.position;
  for (const npc of currentNPCs) {
    if (npc.interaction.type !== 'proximity') continue;
    const radius = npc.interaction.radius ?? 3;
    const alertRadius = radius + 1.5;
    const npcPos = new THREE.Vector3(npc.position.x + 0.5, npc.position.y, npc.position.z + 0.5);
    // Use 2D horizontal distance so camera height doesn't affect trigger range
    const dx = camPos.x - npcPos.x;
    const dz = camPos.z - npcPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > radius) {
      npcsAwaitingExit.delete(npc.id);

      if (activeNPC?.id === npc.id) {
        // Walked away
        endDialogue(npc.id, false);
      } else if (dist <= alertRadius) {
        setNPCStatus(npc.id, 'alert');
      } else {
        setNPCStatus(npc.id, null);
      }
      continue;
    }

    if (npcsAwaitingExit.has(npc.id)) continue;

    if (!activeNPC) {
      setNPCStatus(npc.id, 'thinking');
      // First time in range — start dialogue
      const rootNode = npc.dialogueTree[0];
      if (rootNode) {
        startDialogue(npc.id, rootNode.id);
      }
    }
  }
}

// ── Scene Loading ──────────────────────────────────────────────
async function loadScene(): Promise<void> {
  // Validate config
  const errors = SceneLoader.validate(restaurantConfig);
  if (errors.length > 0) {
    console.error('Scene config validation failed:', errors);
    return;
  }

  // Build voxel world
  const chunkData = SceneLoader.buildChunkData(restaurantConfig);
  world.loadMap(chunkData);
  if (sceneVisualGroup) {
    scene.remove(sceneVisualGroup);
    disposeObject3D(sceneVisualGroup);
  }
  sceneVisualGroup = createRestaurantDecor();
  scene.add(sceneVisualGroup);

  // Spawn NPCs
  currentNPCs = restaurantConfig.npcs;
  spawnNPCs(currentNPCs);

  // Position camera near doorway
  camera.position.set(9, 2.6, 14);
  camera.lookAt(9, 2.5, 5);

  // Start session
  actor.send({ type: 'LOAD_SCENE', sceneId: 'restaurant' });
  actor.send({ type: 'ACTIVATE' });

  console.log('🍽️ Restaurant scene loaded!');
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
    await loadSceneConfig();
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

  // Check NPC proximity every 500ms
  proximityTimer += delta;
  if (proximityTimer > 0.5) {
    proximityTimer = 0;
    checkNPCProximity();
  }

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
