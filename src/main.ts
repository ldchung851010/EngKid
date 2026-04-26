import * as THREE from 'three';
import { createActor } from 'xstate';
import { VoxelWorld } from './engine/renderer/VoxelWorld.js';
import { CameraController } from './engine/renderer/CameraController.js';
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
import type { NPCConfig, DialogueNode } from './engine/schema/SceneConfig.js';

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
let npcMeshes: THREE.Mesh[] = [];

// ── Session State Machine ──────────────────────────────────────
const actor = createActor(sessionMachine);

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
  for (const mesh of npcMeshes) {
    scene.remove(mesh);
    mesh.geometry?.dispose();
    (mesh.material as THREE.Material)?.dispose();
  }
  npcMeshes = [];

  const npcGeo = new THREE.BoxGeometry(0.6, 1.8, 0.6);
  const npcMat = new THREE.MeshStandardMaterial({ color: 0x4fc3f7 });
  const labelCanvas = document.createElement('canvas');

  for (const npc of npcs) {
    const mesh = new THREE.Mesh(npcGeo, npcMat);
    mesh.position.set(npc.position.x + 0.5, npc.position.y + 0.9, npc.position.z + 0.5);
    mesh.castShadow = true;
    mesh.userData = { npcId: npc.id };
    scene.add(mesh);
    npcMeshes.push(mesh);

    // Simple name label via sprite
    labelCanvas.width = 128;
    labelCanvas.height = 32;
    const ctx = labelCanvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(npc.name, 64, 22);

    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelSpriteMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true });
    const labelSprite = new THREE.Sprite(labelSpriteMat);
    labelSprite.position.set(0, 1.3, 0);
    labelSprite.scale.set(2, 0.5, 1);
    mesh.add(labelSprite);
  }
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
  activeNodeId = null;
  activeNPC = null;

  if (waitForExit) {
    npcsAwaitingExit.add(npcId);
  }
}

function isCurrentDialogue(npcId: string, nodeId: string, revision: number): boolean {
  return dialogueRevision === revision && activeNPC?.id === npcId && activeNodeId === nodeId;
}

function isNPCInRange(npc: NPCConfig): boolean {
  const radius = npc.interaction.radius ?? 3;
  const npcPos = new THREE.Vector3(npc.position.x + 0.5, npc.position.y, npc.position.z + 0.5);
  return camera.position.distanceTo(npcPos) <= radius;
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
    }
    return;
  }

  actor.send({ type: 'TASK_TRIGGERED', taskId: 'order_food' });

  const ctx = actor.getSnapshot().context;
  console.log(`[Dialogue] → IntentRouter with ${node.candidateIntents.length} candidates: [${node.candidateIntents.map(c => c.intentId).join(',')}]`);
  const result = await intentRouter.route(transcript, {
    name: activeNPC.name,
    role: activeNPC.role,
  }, node.candidateIntents, ctx.conversationHistory);

  if (!isCurrentDialogue(npcId, nodeId, revision)) return;

  console.log(`[Dialogue] ← intent: ${result.intentId} (confidence=${result.confidence})`);

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
    const npcPos = new THREE.Vector3(npc.position.x + 0.5, npc.position.y, npc.position.z + 0.5);
    const dist = camPos.distanceTo(npcPos);

    if (dist > radius) {
      npcsAwaitingExit.delete(npc.id);

      if (activeNPC?.id === npc.id) {
        // Walked away
        endDialogue(npc.id, false);
      }
      continue;
    }

    if (npcsAwaitingExit.has(npc.id)) continue;

    if (!activeNPC) {
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

  // Spawn NPCs
  currentNPCs = restaurantConfig.npcs;
  spawnNPCs(currentNPCs);

  // Position camera near doorway
  camera.position.set(6, 2, 10);
  camera.lookAt(6, 1, 5);

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

tts.onStatusChange((s) => {
  statusEl.textContent = s.progress;
  if (s.state === 'error') {
    spinner.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.innerHTML = `
      <strong>TTS model failed to load</strong><br><br>
      ${s.error}<br><br>
      Download from HuggingFace:<br>
      <code>KittenML/kitten-tts-nano-0.1</code><br><br>
      Place these files in <code>public/tts-model/</code>:<br>
      &bull; <code>model_quantized.onnx</code><br>
      &bull; <code>voices.json</code><br>
    `;
  }
  if (s.state === 'ready') {
    overlay.style.display = 'none';
    errorEl.style.display = 'none';
  }
});

(async () => {
  try {
    await tts.init();
    await loadScene();
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
