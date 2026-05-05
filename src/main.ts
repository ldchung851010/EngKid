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
import type { FaceExpression } from './engine/renderer/CharacterFactory.js';
import { drawFaceExpression } from './engine/renderer/CharacterFactory.js';
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
const playerGroup = new THREE.Group();
const playerSkinMat = new THREE.MeshStandardMaterial({ color: 0xffccbc, roughness: 0.6, flatShading: true });
const playerShirtMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.6, flatShading: true });
const playerPantsMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.7, flatShading: true });
const playerShoesMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.5, flatShading: true });
const playerHairMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.8, flatShading: true });

// Torso
const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.72, 0.36), playerShirtMat);
pBody.position.y = 1.0;
pBody.castShadow = true;
playerGroup.add(pBody);

// Head with face texture (Minecraft-style)
const SKIN_COLOR = 0xffccbc;
const playerFaceCanvas = document.createElement('canvas');
playerFaceCanvas.width = 64;
playerFaceCanvas.height = 64;
drawFaceExpression(playerFaceCanvas, 'idle', SKIN_COLOR);
const playerFaceTex = new THREE.CanvasTexture(playerFaceCanvas);
playerFaceTex.minFilter = THREE.NearestFilter;
playerFaceTex.magFilter = THREE.NearestFilter;
const playerFaceMat = new THREE.MeshStandardMaterial({ map: playerFaceTex, roughness: 0.6, flatShading: true });
const headSize = 0.5;
const pHead = new THREE.Mesh(
  new THREE.BoxGeometry(headSize, headSize, headSize),
  [playerSkinMat, playerSkinMat, playerSkinMat, playerSkinMat, playerFaceMat, playerSkinMat],
);
pHead.position.y = 1.6;
pHead.castShadow = true;
playerGroup.add(pHead);

// Hair
const pHair = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.56), playerHairMat);
pHair.position.y = 1.88;
pHair.castShadow = true;
playerGroup.add(pHair);

// Legs (pivot at hip via Group)
const pLegL = new THREE.Group();
pLegL.position.set(-0.17, 0.55, 0);
playerGroup.add(pLegL);
const pLegLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.51, 0.22), playerPantsMat);
pLegLMesh.position.y = -0.255;
pLegLMesh.castShadow = true;
pLegL.add(pLegLMesh);
const pShoeL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.28), playerShoesMat);
pShoeL.position.set(0, -0.51, 0.03);
pLegL.add(pShoeL);

const pLegR = new THREE.Group();
pLegR.position.set(0.17, 0.55, 0);
playerGroup.add(pLegR);
const pLegRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.51, 0.22), playerPantsMat);
pLegRMesh.position.y = -0.255;
pLegRMesh.castShadow = true;
pLegR.add(pLegRMesh);
const pShoeR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.28), playerShoesMat);
pShoeR.position.set(0, -0.51, 0.03);
pLegR.add(pShoeR);

// Arms (pivot at shoulder via Group)
const pArmL = new THREE.Group();
pArmL.position.set(-0.42, 1.32, 0);
playerGroup.add(pArmL);
const pArmLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.56, 0.2), playerSkinMat);
pArmLMesh.position.y = -0.28;
pArmLMesh.castShadow = true;
pArmL.add(pArmLMesh);

const pArmR = new THREE.Group();
pArmR.position.set(0.42, 1.32, 0);
playerGroup.add(pArmR);
const pArmRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.56, 0.2), playerSkinMat);
pArmRMesh.position.y = -0.28;
pArmRMesh.castShadow = true;
pArmR.add(pArmRMesh);

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
  group.userData.isPortal = true;
  const start = config.start ?? { position: { x: 0, y: 2.6, z: 0 }, lookAt: { x: 0, y: 2.3, z: 0 } };

  const portalPos = {
    x: start.position.x,
    y: 1,
    z: start.position.z + 1.5,
  };
  group.position.set(portalPos.x, portalPos.y, portalPos.z);
  group.userData.portalPulse = 0;

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x5e4b8c,
    roughness: 0.35,
    metalness: 0.55,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xffc048,
    roughness: 0.2,
    metalness: 0.65,
    emissive: 0xff9f43,
    emissiveIntensity: 0.3,
  });

  const portalW = 1.05;
  const portalH = 1.65;
  const pillarW = 0.2;
  const pillarD = 0.15;
  const lintelH = 0.18;
  const baseTop = 0.22; // top of the two-step foundation

  // ── Left pillar ──
  const leftPillar = new THREE.Mesh(
    new THREE.BoxGeometry(pillarW, portalH, pillarD),
    frameMat
  );
  leftPillar.position.set(-(portalW + pillarW) / 2, baseTop + portalH / 2, 0);
  leftPillar.castShadow = true;
  group.add(leftPillar);

  // ── Right pillar ──
  const rightPillar = new THREE.Mesh(
    new THREE.BoxGeometry(pillarW, portalH, pillarD),
    frameMat
  );
  rightPillar.position.set((portalW + pillarW) / 2, baseTop + portalH / 2, 0);
  rightPillar.castShadow = true;
  group.add(rightPillar);

  // ── Top lintel (横梁) ──
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(portalW + pillarW * 2 + 0.06, lintelH, pillarD + 0.04),
    frameMat
  );
  lintel.position.set(0, baseTop + portalH + lintelH / 2, 0);
  lintel.castShadow = true;
  group.add(lintel);

  // ── Trim: thin glowing edges on pillars ──
  const trimGeo = new THREE.BoxGeometry(pillarW + 0.04, portalH + 0.02, 0.02);
  const leftTrim = new THREE.Mesh(trimGeo, trimMat);
  leftTrim.position.set(-(portalW + pillarW) / 2, baseTop + portalH / 2, pillarD / 2 + 0.01);
  group.add(leftTrim);
  const rightTrim = new THREE.Mesh(trimGeo, trimMat);
  rightTrim.position.set((portalW + pillarW) / 2, baseTop + portalH / 2, pillarD / 2 + 0.01);
  group.add(rightTrim);

  // Top trim
  const topTrimGeo = new THREE.BoxGeometry(portalW + pillarW * 2 + 0.12, 0.02, pillarD + 0.06);
  const topTrim = new THREE.Mesh(topTrimGeo, trimMat);
  topTrim.position.set(0, baseTop + portalH + lintelH + 0.01, 0);
  group.add(topTrim);

  // ── Keystone (top-center gem) ──
  const gemGeo = new THREE.IcosahedronGeometry(0.12, 1);
  const gemMat = new THREE.MeshStandardMaterial({
    color: 0xff6b6b,
    roughness: 0.05,
    metalness: 0.2,
    emissive: 0xff6b6b,
    emissiveIntensity: 0.7,
  });
  const gem = new THREE.Mesh(gemGeo, gemMat);
  gem.position.set(0, baseTop + portalH + lintelH + 0.08, 0);
  gem.userData.portalPart = 'gem';
  group.add(gem);

  // ── Doorway curtain (energy surface) ──
  const curtainGeo = new THREE.PlaneGeometry(portalW, portalH);
  const curtainMat = new THREE.MeshStandardMaterial({
    color: 0x8e44ad,
    roughness: 0.25,
    metalness: 0.4,
    emissive: 0x6c5ce7,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
  });
  const curtain = new THREE.Mesh(curtainGeo, curtainMat);
  curtain.position.set(0, baseTop + portalH / 2, 0);
  curtain.userData.portalPart = 'curtain';
  group.add(curtain);

  // ── Back glow (softer disc behind curtain) ──
  const glowGeo = new THREE.PlaneGeometry(portalW + 0.15, portalH + 0.15);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xd6a2e8,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.set(0, baseTop + portalH / 2, -0.08);
  group.add(glow);

  // ── Base platform (two-step foundation) ──
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x7d6a9e, roughness: 0.5, metalness: 0.3 });

  const step1Geo = new THREE.CylinderGeometry(portalW / 2 + pillarW + 0.22, portalW / 2 + pillarW + 0.28, 0.12, 32);
  const step1 = new THREE.Mesh(step1Geo, baseMat);
  step1.position.set(0, 0.06, 0);
  step1.castShadow = true;
  step1.receiveShadow = true;
  group.add(step1);

  const step2Geo = new THREE.CylinderGeometry(portalW / 2 + pillarW + 0.10, portalW / 2 + pillarW + 0.15, 0.10, 32);
  const step2 = new THREE.Mesh(step2Geo, baseMat);
  step2.position.set(0, 0.17, 0);
  step2.castShadow = true;
  step2.receiveShadow = true;
  group.add(step2);

  // ── Label ──
  const label = createTextSprite('🏠 Home', 256, 64, '#ffffff', 'bold 28px sans-serif');
  label.position.set(0, baseTop + portalH + lintelH + 0.42, 0);
  label.scale.set(2.0, 0.5, 1);
  label.material.depthTest = false;
  label.material.depthWrite = false;
  group.add(label);

  // ── Floating particles ──
  const particleSpecs = [
    { x: -0.55, y: baseTop + 1.0, z: 0.15, size: 0.05, speed: 1.8, amp: 0.2, phase: 0 },
    { x: 0.55, y: baseTop + 1.2, z: 0.12, size: 0.04, speed: 1.4, amp: 0.15, phase: 1 },
    { x: 0.0, y: baseTop + 1.7, z: 0.18, size: 0.06, speed: 2.0, amp: 0.1, phase: 2 },
    { x: -0.3, y: baseTop + 0.5, z: 0.1, size: 0.035, speed: 1.2, amp: 0.12, phase: 3 },
    { x: 0.3, y: baseTop + 0.6, z: 0.14, size: 0.045, speed: 1.6, amp: 0.18, phase: 1.5 },
  ];

  for (const spec of particleSpecs) {
    const geo = new THREE.SphereGeometry(spec.size, 10, 10);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffeaa7,
      roughness: 0.1,
      emissive: 0xff9f43,
      emissiveIntensity: 1.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.portalParticle = {
      baseX: spec.x,
      baseY: spec.y,
      baseZ: spec.z,
      speed: spec.speed,
      amp: spec.amp,
      phase: spec.phase,
    };
    group.add(mesh);
  }

  return group;
}

function animatePortal(delta: number, elapsed: number): void {
  if (!portalGroup) return;

  portalGroup.children.forEach((child) => {
    // Rotate keystone gem
    if (child.userData.portalPart === 'gem') {
      child.rotation.y += delta * 1.2;
      child.rotation.x = Math.sin(elapsed * 1.5) * 0.15;
    }

    // Slowly sway curtain
    if (child.userData.portalPart === 'curtain' && child instanceof THREE.Mesh) {
      const mat = child.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.4 + Math.sin(elapsed * 2.5) * 0.15;
    }

    // Float particles gently up and down
    const p = child.userData.portalParticle;
    if (!p) return;
    p.phase += delta * p.speed;
    child.position.x = p.baseX + Math.sin(p.phase) * p.amp;
    child.position.y = p.baseY + Math.cos(p.phase * 0.7) * p.amp * 0.5;
    child.position.z = p.baseZ + Math.sin(p.phase * 1.3) * p.amp * 0.3;
  });

  // Breathing pulse
  portalGroup.userData.portalPulse = (portalGroup.userData.portalPulse ?? 0) + delta * 2.0;
  const pulse = 1 + Math.sin(portalGroup.userData.portalPulse) * 0.025;
  portalGroup.scale.setScalar(pulse);
}

function animateSceneVisuals(delta: number, elapsed: number): void {
  if (!sceneVisualGroup) return;
  activeSceneModule?.animateVisuals?.(sceneVisualGroup, delta, elapsed);
}

function getPortalDistance(): number {
  if (!portalGroup) return Infinity;
  const pp = portalGroup.position;
  const dx = playerGroup.position.x - pp.x;
  const dz = playerGroup.position.z - pp.z;
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
    const dx = playerGroup.position.x - npcPos.x;
    const dz = playerGroup.position.z - npcPos.z;
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
        const dy = playerGroup.position.y - (npcPos.y + 1.55);
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
      // Find the head mesh with face canvas (Minecraft-style texture)
      const headMesh = group.children.find(
        (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.userData.isFace === true,
      );
      if (headMesh) {
        const canvas = headMesh.userData.faceCanvas as HTMLCanvasElement | undefined;
        const skinColor = headMesh.userData.skinColor as number | undefined;
        if (canvas && skinColor !== undefined) {
          drawFaceExpression(canvas, expression, skinColor);
          const tex = headMesh.userData.faceTexture as THREE.CanvasTexture | undefined;
          if (tex) tex.needsUpdate = true;
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
  try {
    await speakNPC(node);
  } catch (error) {
    console.warn('[TTS] dialogue speech failed', error);
    showServiceNotice('Voice is unavailable right now. You can keep practicing.');
  }

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

// ── Mic & Speech Pipeline ──────────────────────────────────────
const micContainer = document.getElementById('mic-container')!;
const pipeline = new SpeechPipeline({
  onStateChange: (state) => console.log(`[pipeline] ${state}`),
  onTranscript: (text) => console.log(`[ASR] "${text}"`),
}, transcribe);

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

  if (target.type === 'portal') {
    interactionLabel.textContent = 'Go home 🚪';
  } else if (target.type === 'npc') {
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

  const portalDist = getPortalDistance();
  const portalTarget: InteractionTarget | null =
    portalDist <= PORTAL_INTERACTION_RADIUS ? { type: 'portal', distance: portalDist } : null;

  const npcTarget = getNearestNPCTarget();
  const collectibleTarget = collectibleManager?.getNearestCollectible(playerGroup.position, COLLECTIBLE_INTERACTION_RADIUS) ?? null;

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

// ── Click Interaction Setup ────────────────────────────────────
function getCollectibleDistance(obj: THREE.Object3D): number {
  const worldPos = new THREE.Vector3();
  obj.getWorldPosition(worldPos);
  const dx = playerGroup.position.x - worldPos.x;
  const dz = playerGroup.position.z - worldPos.z;
  return Math.sqrt(dx * dx + dz * dz);
}

controller.setOnObjectClick((hitObject) => {
  // Determine what was clicked
  if (hitObject.userData.isPortal) {
    if (getPortalDistance() <= PORTAL_INTERACTION_RADIUS) {
      navigateToHome();
    }
    return;
  }

  const npcId = hitObject.userData.npcId as string | undefined;
  if (npcId) {
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

  const collectibleWord = hitObject.userData.collectibleWord as string | undefined;
  if (collectibleWord && collectibleManager) {
    if (getCollectibleDistance(hitObject) <= COLLECTIBLE_INTERACTION_RADIUS) {
      collectibleManager.setActiveCollectible(collectibleWord);
      void collectibleManager.openActiveCollectible();
    }
  }
});

controller.setOnGroundClick((_worldPos) => {
  // Cancel any active dialogue when clicking ground
  if (activeNPC) {
    endDialogue(activeNPC.id, false);
  }
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
  collectibleManager = new CollectibleManager(scene, camera, tts, activeSceneId, activeSceneConfig, transcribe);
  await collectibleManager.init();

  // Register clickable objects for interaction
  const clickables: THREE.Object3D[] = [];
  for (const npcGroup of npcMeshes) {
    clickables.push(npcGroup);
  }
  if (portalGroup) {
    clickables.push(portalGroup);
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
    await tts.init();
    await loadSceneModule();
    statusEl.textContent = 'Building scene...';
    await loadScene();
    isSceneReady = true;

    statusEl.textContent = 'Loading ASR model... 0%';
    await whisperASR.loadModel(undefined, (pct) => {
      statusEl.textContent = `Loading ASR model... ${pct}%`;
    });
    statusEl.textContent = 'ASR model ready ✓';
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
  if (obj.userData.isPortal) return getPortalDistance() <= PORTAL_INTERACTION_RADIUS;
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
    const legSwing = Math.sin(walkPhase) * 0.45;
    const armSwing = Math.sin(walkPhase) * 0.35;
    pLegL.rotation.x = legSwing;
    pLegR.rotation.x = -legSwing;
    pArmL.rotation.x = -armSwing;
    pArmR.rotation.x = armSwing;
  } else {
    walkPhase = 0;
    pLegL.rotation.x = 0;
    pLegR.rotation.x = 0;
    pArmL.rotation.x = 0;
    pArmR.rotation.x = 0;
  }

  collectibleManager?.update(delta);
  animatePortal(delta, clock.elapsedTime);
  animateNPCs(delta);
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
