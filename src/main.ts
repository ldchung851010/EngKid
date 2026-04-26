import * as THREE from 'three';
import { VoxelWorld } from './engine/renderer/VoxelWorld.js';
import { CameraController } from './engine/renderer/CameraController.js';
import { BlockType } from './engine/renderer/BlockTypes.js';
import type { ChunkData } from './engine/renderer/ChunkBuilder.js';

// ── Basic Scene Setup ──────────────────────────────────────────
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
camera.position.set(8, 8, 12);
camera.lookAt(4, 2, 4);

// ── Lighting ───────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(20, 30, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

// ── Voxel World ────────────────────────────────────────────────
const world = new VoxelWorld(scene);

// Build a test restaurant: 12×4×12, walls, floor, tables
const W = 12, H = 4, D = 12;
const size = W * H * D;
const blocks = new Uint8Array(size);
const idx = (x: number, y: number, z: number) => x + z * W + y * W * D;

// Floor (y=0)
for (let z = 0; z < D; z++) {
  for (let x = 0; x < W; x++) {
    blocks[idx(x, 0, z)] = BlockType.FLOOR;
  }
}

// Walls (y=1..3, perimeter)
for (let y = 1; y < H; y++) {
  for (let x = 0; x < W; x++) {
    blocks[idx(x, y, 0)] = BlockType.WALL;
    blocks[idx(x, y, D - 1)] = BlockType.WALL;
  }
  for (let z = 1; z < D - 1; z++) {
    blocks[idx(0, y, z)] = BlockType.WALL;
    blocks[idx(W - 1, y, z)] = BlockType.WALL;
  }
}

// Doorway (open gap in front wall)
blocks[idx(6, 1, D - 1)] = BlockType.AIR;
blocks[idx(6, 2, D - 1)] = BlockType.AIR;

// Tables and chairs
const placeBlock = (x: number, z: number, type: BlockType) => {
  blocks[idx(x, 1, z)] = type;
};

// Table 1
placeBlock(3, 3, BlockType.TABLE);
placeBlock(2, 2, BlockType.CHAIR);
placeBlock(4, 2, BlockType.CHAIR);
placeBlock(2, 4, BlockType.CHAIR);
placeBlock(4, 4, BlockType.CHAIR);

// Table 2
placeBlock(8, 3, BlockType.TABLE);
placeBlock(7, 2, BlockType.CHAIR);
placeBlock(9, 2, BlockType.CHAIR);
placeBlock(7, 4, BlockType.CHAIR);
placeBlock(9, 4, BlockType.CHAIR);

// Counter
for (let x = 4; x <= 7; x++) {
  blocks[idx(x, 1, D - 3)] = BlockType.COUNTER;
}

const chunk: ChunkData = {
  originX: 0,
  originY: 0,
  originZ: 0,
  width: W,
  height: H,
  depth: D,
  data: blocks,
};

world.loadMap(chunk);

// ── Camera Controller ──────────────────────────────────────────
const controller = new CameraController(camera, renderer.domElement);

// ── Clock ──────────────────────────────────────────────────────
const clock = new THREE.Clock();

// ── Render Loop ────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  controller.update(delta);

  renderer.render(scene, camera);
}
animate();

// ── Resize Handler ─────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

console.log('🍽️ Scene Engine — restaurant loaded');
