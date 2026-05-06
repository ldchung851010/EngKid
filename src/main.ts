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
import { PathGrid } from './engine/runtime/PathGrid.js';
import { ScoreTracker } from './engine/scoring/ScoreTracker.js';
import { IntentRouter } from './engine/voice/IntentRouter.js';
import { SpeechPipeline } from './engine/voice/SpeechPipeline.js';
import { WhisperASR } from './engine/voice/WhisperASR.js';
import { TTSEngine } from './engine/voice/TTSEngine.js';
import { MicButton } from './engine/voice/MicButton.js';
import type { NPCConfig, DialogueNode, SceneConfig } from './engine/schema/SceneConfig.js';
import { emptySceneHooks, type SceneHooks, type SceneModule } from './engine/runtime/SceneModule.js';
import { createPlayerCharacter, animatePlayerWalk } from './engine/renderer/PlayerCharacter.js';
import { NPCAnimator } from './engine/renderer/NPCAnimator.js';
import { CollectibleManager } from './engine/collectibles/index.js';
import { learningDataStore } from './engine/runtime/LearningDataStore.js';

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
scene.background = new THREE.Color(0x8bc34a);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

// ── Lighting ───────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x404060, 0.9));
const sun = new THREE.DirectionalLight(0xffeedd, 1.5);
sun.position.set(10, 20, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
const shadowD = 15;
sun.shadow.camera.left = -shadowD;
sun.shadow.camera.right = shadowD;
sun.shadow.camera.top = shadowD;
sun.shadow.camera.bottom = -shadowD;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 30;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xffffbb, 0x080820, 0.8));

// ── Player Character ───────────────────────────────────────────
const { group: playerGroup, limbs: playerLimbs } = createPlayerCharacter();
scene.add(playerGroup);

// ── Engine Components ──────────────────────────────────────────
const world = new VoxelWorld(scene);
const controller = new CameraController(camera, playerGroup, renderer.domElement);
const collisionWorld = new CollisionWorld();
const pathGrid = new PathGrid();
const PLAYER_COLLISION_RADIUS = 0.62;
const NPC_INTERACTION_RADIUS_PADDING = 0.25;
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

const npcAnimator = new NPCAnimator();
let collectibleManager: CollectibleManager | null = null;
type InteractionTarget =
  | { type: 'npc'; npc: NPCConfig; distance: number }
  | { type: 'collectible'; word: string; distance: number };
let activeInteractionTarget: InteractionTarget | null = null;

function navigateToHome(): void {
  location.href = '/';
}

function animateSceneVisuals(delta: number, elapsed: number): void {
  if (!sceneVisualGroup) return;
  activeSceneModule?.animateVisuals?.(sceneVisualGroup, delta, elapsed);
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
  npcAnimator.clear();

  for (const npc of npcs) {
    const group = createVoxelCharacter(npc);
    group.userData.npcId = npc.id;
    scene.add(group);
    npcMeshes.push(group);

    npcAnimator.initState(npc.id, group.position.y);

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
  sprite.raycast = () => {};
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
let startingDialogue = false;
let dialogueRetries = 0;
let dialogueRevision = 0;
const npcsAwaitingExit = new Set<string>();
const MAX_RETRIES = 3;

async function startDialogue(npcId: string, nodeId: string): Promise<void> {
  if (activeNPC || startingDialogue) return;
  startingDialogue = true;
  controller.setMovementLock(true);

  const npc = currentNPCs.find((n) => n.id === npcId);
  if (!npc) { startingDialogue = false; return; }

  const node = findNode(npc, nodeId);
  if (!node) { console.log(`[Dialogue] ⚠️ node ${nodeId} not found`); startingDialogue = false; return; }

  console.log(`[Dialogue] NPC ${npcId} → "${node.npcText.substring(0, 50)}..."`);
  // Hook gate check
  const ctx = actor.getSnapshot().context;
  if (!activeSceneHooks.onBeforeDialogue(npcId, nodeId, ctx)) { startingDialogue = false; return; }

  activeNPC = npc;
  activeNodeId = nodeId;
  activeInteractionTarget = null;
  collectibleManager?.setActiveCollectible(null);
  dialogueRetries = 0;
  const revision = ++dialogueRevision;

  // Face the player toward the NPC
  const npcPos = new THREE.Vector3(npc.position.x + 0.5, 0, npc.position.z + 0.5);
  controller.faceToward(npcPos);

  setNPCStatus(npcId, 'thinking');
  try {
    await speakNPC(node);
  } catch (error) {
    console.warn('[TTS] dialogue speech failed', error);
    showServiceNotice('Voice is unavailable right now. You can keep practicing.');
  }

  if (!isCurrentDialogue(npcId, nodeId, revision)) {
    startingDialogue = false;
    return;
  }
  if (!isNPCInRange(npc)) {
    endDialogue(npcId, false);
    return;
  }

  if (node.isTerminal || node.candidateIntents.length === 0) {
    endDialogue(npcId, true);
    return;
  }

  showMicWithHints(node);
  startingDialogue = false;
}

function endDialogue(npcId: string, waitForExit: boolean): void {
  dialogueRevision++;
  micButton.hide();
  setNPCStatus(npcId, null);
  activeNodeId = null;
  activeNPC = null;
  activeInteractionTarget = null;
  startingDialogue = false;
  controller.setMovementLock(false);

  if (waitForExit) {
    npcsAwaitingExit.add(npcId);
    saveProgress();
  }
}

async function saveProgress(): Promise<void> {
  const score = scoreTracker.getSessionScore(activeSceneConfig.tasks.length);
  const completed = score.completedCount === score.totalTasks;
  const result = learningDataStore.saveSceneProgress({ sceneId: activeSceneId, score: score.total, completed });
  if (!result.ok) {
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
  const dx = playerGroup.position.x - npcPos.x;
  const dz = playerGroup.position.z - npcPos.z;
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

// ── ASR ────────────────────────────────────────────────────────
const whisperASR = new WhisperASR();
const transcribe = (audioData: Float32Array) => whisperASR.transcribe(audioData);
let cloudAsrUrl: string | undefined;

// Detect cloud ASR mode from server health endpoint
async function detectAsrMode(): Promise<string | undefined> {
  try {
    const health = await fetch('/api/health').then(r => r.json());
    if (health.asr === 'cloud') return '/api/asr';
  } catch { /* server unreachable, use local ASR */ }
  return undefined;
}

// ── Mic & Speech Pipeline ──────────────────────────────────────
const micContainer = document.getElementById('mic-container')!;
let pipeline: SpeechPipeline;
let micButton: MicButton;

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
    npcText: node.npcText,
    hintExamples: node.hintExamples,
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
      endDialogue(npcId, false);
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
        endDialogue(npcId, false);
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
      } catch {
        showServiceNotice('Voice is unavailable right now. You can keep practicing.');
      }
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

  if (target.type === 'npc') {
    interactionLabel.textContent = `Talk to ${target.npc.name}`;
  } else {
    interactionLabel.textContent = `Collect ${target.word}`;
  }
  interactionPrompt.style.display = 'flex';
}

function showServiceNotice(message: string): void {
  let notice = document.getElementById('service-notice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'service-notice';
    document.body.appendChild(notice);
  }
  notice.textContent = message;
  notice.classList.add('visible');
  window.setTimeout(() => notice?.classList.remove('visible'), 5000);
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

  const npcTarget = getNearestNPCTarget();
  const collectibleTarget = collectibleManager?.getNearestCollectible(playerGroup.position, COLLECTIBLE_INTERACTION_RADIUS) ?? null;

  // Closest target wins
  const candidates: InteractionTarget[] = [];
  if (npcTarget) candidates.push(npcTarget);
  if (collectibleTarget) candidates.push({ type: 'collectible', word: collectibleTarget.word, distance: collectibleTarget.distance });

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

// ── Click Interaction Setup ────────────────────────────────────
function getCollectibleDistance(obj: THREE.Object3D): number {
  const worldPos = new THREE.Vector3();
  obj.getWorldPosition(worldPos);
  const dx = playerGroup.position.x - worldPos.x;
  const dz = playerGroup.position.z - worldPos.z;
  return Math.sqrt(dx * dx + dz * dz);
}

controller.setOnObjectClick((hitObject) => {
  // Block all interactions during dialogue initiation
  if (startingDialogue) return;

  // Determine what was clicked
  const npcId = hitObject.userData.npcId as string | undefined;
  if (npcId) {
    if (activeNPC) return; // Already in dialogue
    const npc = currentNPCs.find((n) => n.id === npcId);
    if (npc) {
      const dist = getNPCDistance(npc);
      if (dist <= getNPCInteractionRadius(npc)) {
        const rootNode = npc.dialogueTree[0];
        if (rootNode) void startDialogue(npc.id, rootNode.id);
      } else {
        const targetPos = new THREE.Vector3(npc.position.x + 0.5, 0, npc.position.z + 0.5);
        controller.setMoveTarget(targetPos);
      }
    }
    return;
  }

  // Block collectible clicks during active dialogue
  if (activeNPC) return;

  const collectibleWord = hitObject.userData.collectibleWord as string | undefined;
  if (collectibleWord && collectibleManager) {
    if (getCollectibleDistance(hitObject) <= COLLECTIBLE_INTERACTION_RADIUS) {
      collectibleManager.setActiveCollectible(collectibleWord);
      void collectibleManager.openActiveCollectible();
    }
  }
});

controller.setOnGroundClick((_worldPos) => {
  // During dialogue or initiation: cancel dialogue and prevent any movement
  if (activeNPC || startingDialogue) {
    if (activeNPC) endDialogue(activeNPC.id, false);
    else {
      startingDialogue = false;
      controller.setMovementLock(false);
    }
    return false;
  }
  return true;
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

  // Build pathfinding grid
  pathGrid.build(
    activeSceneConfig.map.width,
    activeSceneConfig.map.depth,
    (pos) => collisionWorld.canOccupy(pos, { radius: PLAYER_COLLISION_RADIUS }),
  );
  controller.setPathfinder((start, end) => pathGrid.findPath(start, end));

  // Spawn NPCs
  currentNPCs = activeSceneConfig.npcs;
  spawnNPCs(currentNPCs);
  collectibleManager = new CollectibleManager(scene, camera, tts, activeSceneId, activeSceneConfig, transcribe, learningDataStore, cloudAsrUrl);
  await collectibleManager.init();

  // Register clickable objects for interaction
  const clickables: THREE.Object3D[] = [];
  for (const npcGroup of npcMeshes) {
    clickables.push(npcGroup);
  }
  // Collectible groups
  if (collectibleManager) {
    for (const group of collectibleManager.getCollectibleGroups()) {
      clickables.push(group);
    }
  }
  controller.setClickableObjects(clickables);

  const skyColor = activeSceneConfig.environment?.skyColor ?? 0x8bc34a;
  scene.background = new THREE.Color(skyColor);

  const start = activeSceneConfig.start ?? {
    position: { x: activeSceneConfig.map.width / 2, y: 0, z: activeSceneConfig.map.depth - 2 },
    lookAt: { x: activeSceneConfig.map.width / 2, y: 0, z: activeSceneConfig.map.depth / 2 },
  };
  playerGroup.position.set(start.position.x, 1, start.position.z);

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
const controlsHint = document.getElementById('controls-hint');
const controlsHintClose = document.getElementById('controls-hint-close');
document.getElementById('home-btn')?.addEventListener('click', navigateToHome);
let isSceneReady = false;
let isASRReady = false;
let hasShownControlsHint = false;
let controlsHintTimer: number | null = null;

function hideLoadingOverlay(): void {
  if (!isSceneReady || !isASRReady) return;
  overlay.style.display = 'none';
  errorEl.style.display = 'none';
  showControlsHint();
}

function hideControlsHint(): void {
  controlsHint?.classList.add('hidden');
  if (controlsHintTimer !== null) {
    window.clearTimeout(controlsHintTimer);
    controlsHintTimer = null;
  }
}

function showControlsHint(): void {
  if (!controlsHint || hasShownControlsHint) return;

  hasShownControlsHint = true;
  controlsHint.classList.remove('hidden');
  controlsHintTimer = window.setTimeout(hideControlsHint, 12000);
}

controlsHintClose?.addEventListener('click', hideControlsHint);

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
    // Detect cloud ASR mode before building scene (needed for pipeline construction)
    cloudAsrUrl = await detectAsrMode();

    await tts.init();
    await loadSceneModule();
    statusEl.textContent = 'Building scene...';
    await loadScene();
    isSceneReady = true;

    // Create speech pipeline now that we know the ASR mode
    pipeline = new SpeechPipeline({
      onStateChange: (state) => console.log(`[pipeline] ${state}`),
      onTranscript: (text) => console.log(`[ASR] "${text}"`),
    }, transcribe, cloudAsrUrl);
    micButton = new MicButton(micContainer, pipeline, async (transcript) => {
      await handleChildSpeech(transcript);
    });

    if (cloudAsrUrl) {
      console.log('[ASR] using cloud ASR (server-side GLM-ASR)');
      statusEl.textContent = 'Cloud ASR ready ✓';
    } else {
      statusEl.textContent = 'Loading ASR model... 0%';
      await whisperASR.loadModel(undefined, (pct) => {
        statusEl.textContent = `Loading ASR model... ${pct}%`;
      });
      statusEl.textContent = 'ASR model ready ✓';
    }

    isASRReady = true;
    hideLoadingOverlay();
  } catch (err) {
    console.error('Startup failed:', err);
    statusEl.textContent = 'ASR model failed to load';
    spinner.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.innerHTML = `<strong>Failed to load ASR model</strong><br><br>${err}`;
  }
})();

// ── Proximity Pulse Glow & Cursor ──────────────────────────────
const glowingObjects = new Set<THREE.Object3D>();

function isObjectInRange(obj: THREE.Object3D): boolean {
  if (obj.userData.npcId) {
    const npc = currentNPCs.find((n) => n.id === obj.userData.npcId);
    return npc ? getNPCDistance(npc) <= getNPCInteractionRadius(npc) : false;
  }
  if (obj.userData.collectibleWord) return getCollectibleDistance(obj) <= COLLECTIBLE_INTERACTION_RADIUS;
  return false;
}

/** Get all MeshStandardMaterial instances from a mesh (handles single and multi-material) */
function getMeshMaterials(mesh: THREE.Mesh): THREE.MeshStandardMaterial[] {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return mats.filter((m): m is THREE.MeshStandardMaterial => m instanceof THREE.MeshStandardMaterial);
}

function applyEmissiveGlow(obj: THREE.Object3D): void {
  if (glowingObjects.has(obj)) return;
  glowingObjects.add(obj);
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mats = getMeshMaterials(child);
      child.userData._savedMaterials = mats.map((m) => ({
        material: m,
        emissive: m.emissive.clone(),
        emissiveIntensity: m.emissiveIntensity,
      }));
    }
  });
}

function removeEmissiveGlow(obj: THREE.Object3D): void {
  if (!glowingObjects.delete(obj)) return;
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData._savedMaterials) {
      for (const saved of child.userData._savedMaterials) {
        saved.material.emissive.copy(saved.emissive);
        saved.material.emissiveIntensity = saved.emissiveIntensity;
      }
      delete child.userData._savedMaterials;
    }
  });
}

function updateInteractionIndicators(elapsed: number): void {
  const inRange = new Set<THREE.Object3D>();
  for (const obj of controller.getClickableObjects()) {
    if (isObjectInRange(obj)) inRange.add(obj);
  }

  for (const obj of inRange) applyEmissiveGlow(obj);
  for (const obj of [...glowingObjects]) {
    if (!inRange.has(obj)) removeEmissiveGlow(obj);
  }

  // Pulse emissive intensity
  const pulse = 0.3 + Math.sin(elapsed * 3.5) * 0.25;
  const glowColor = new THREE.Color(0xffee58);
  for (const obj of glowingObjects) {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        for (const m of getMeshMaterials(child)) {
          m.emissive.copy(glowColor);
          m.emissiveIntensity = pulse;
        }
      }
    });
  }
}

// Update cursor on mouse move
renderer.domElement.addEventListener('mousemove', (e: MouseEvent) => {
  const hitObj = controller.hitTestAtScreen(e.clientX, e.clientY);
  if (hitObj && isObjectInRange(hitObj)) {
    renderer.domElement.style.cursor = 'pointer';
  } else {
    renderer.domElement.style.cursor = '';
  }
});

// ── Render Loop ────────────────────────────────────────────────
const clock = new THREE.Clock();
let walkPhase = 0;

function animate(): void {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1); // Cap delta
  controller.update(delta);

  // Player walk animation
  if (controller.isMoving) {
    walkPhase += delta * 10;
  } else {
    walkPhase = 0;
  }
  animatePlayerWalk(playerLimbs, controller.isMoving, walkPhase);

  collectibleManager?.update(delta);
  npcAnimator.animate(delta, npcMeshes, playerGroup.position, activeNPC?.id ?? null, activeNodeId);
  animateSceneVisuals(delta, clock.elapsedTime);
  updateInteractionIndicators(clock.elapsedTime);

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
