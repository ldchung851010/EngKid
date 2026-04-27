import * as THREE from 'three';
import { addBox, addLocalBox, createTextSprite } from '../../engine/renderer/ScenePrimitives.js';

const mat = {
  trunk: new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.82 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.92 }),
  leafLight: new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.92 }),
  fence: new THREE.MeshStandardMaterial({ color: 0xffcc80, roughness: 0.78 }),
  rope: new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.72 }),
  sign: new THREE.MeshStandardMaterial({ color: 0xffe082, roughness: 0.55 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.82 }),
  lion: new THREE.MeshStandardMaterial({ color: 0xffb74d, roughness: 0.76 }),
  mane: new THREE.MeshStandardMaterial({ color: 0x8d4b2d, roughness: 0.8 }),
  monkey: new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.78 }),
  elephant: new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.78 }),
  water: new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.25, transparent: true, opacity: 0.72 }),
};

export function createZooDecor(): THREE.Group {
  const group = new THREE.Group();

  addPathEdges(group);
  addHabitatFence(group, 3.6, 8.7, 5.4, 8.2, 'LIONS');
  addHabitatFence(group, 17.6, 8.7, 5.2, 8.2, 'MONKEYS');
  addPond(group);
  addTrees(group);
  addAnimalModels(group);
  addBenches(group);

  return group;
}

function addPathEdges(group: THREE.Group): void {
  const flowerColors = [0xef5350, 0xffca28, 0xab47bc, 0x42a5f5];
  for (let z = 1.5; z < 13; z += 1.2) {
    addBox(group, [7.55, 1.08, z], [0.26, 0.12, 0.26], mat.stone);
    addBox(group, [14.45, 1.08, z], [0.26, 0.12, 0.26], mat.stone);
  }
  for (let i = 0; i < 20; i++) {
    const x = i % 2 === 0 ? 6.9 : 15.1;
    const z = 1.6 + (i % 12) * 1.15;
    addBox(group, [x, 1.14, z], [0.26, 0.18, 0.26], new THREE.MeshStandardMaterial({ color: flowerColors[i % flowerColors.length], roughness: 0.7 }));
  }
}

function addHabitatFence(group: THREE.Group, cx: number, cz: number, width: number, depth: number, label: string): void {
  const minX = cx - width / 2;
  const maxX = cx + width / 2;
  const minZ = cz - depth / 2;
  const maxZ = cz + depth / 2;
  for (let x = minX; x <= maxX; x += 1) {
    addFencePost(group, x, minZ);
    addFencePost(group, x, maxZ);
  }
  for (let z = minZ + 1; z < maxZ; z += 1) {
    addFencePost(group, minX, z);
    addFencePost(group, maxX, z);
  }
  addBox(group, [cx, 1.64, minZ], [width + 0.35, 0.12, 0.12], mat.rope);
  addBox(group, [cx, 2.16, minZ], [width + 0.35, 0.12, 0.12], mat.rope);
  addBox(group, [cx, 1.64, maxZ], [width + 0.35, 0.12, 0.12], mat.rope);
  addBox(group, [cx, 2.16, maxZ], [width + 0.35, 0.12, 0.12], mat.rope);
  addBox(group, [minX, 1.64, cz], [0.12, 0.12, depth + 0.35], mat.rope);
  addBox(group, [maxX, 1.64, cz], [0.12, 0.12, depth + 0.35], mat.rope);
  addBox(group, [cx, 2.55, minZ - 0.15], [2.2, 0.55, 0.12], mat.sign);
  const sign = createTextSprite(label, 256, 80, '#4e342e', 'bold 34px sans-serif');
  sign.position.set(cx, 2.58, minZ - 0.24);
  sign.scale.set(1.6, 0.45, 1);
  group.add(sign);
}

function addFencePost(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 1.58, z], [0.16, 1.15, 0.16], mat.fence);
}

function addPond(group: THREE.Group): void {
  addBox(group, [3.5, 1.06, 6], [3.9, 0.08, 3.4], mat.water);
  for (const [x, z] of [[1.8, 4.4], [5.3, 4.7], [1.9, 7.6], [5.4, 7.4]]) {
    addBox(group, [x, 1.16, z], [0.55, 0.22, 0.45], mat.stone);
  }
}

function addTrees(group: THREE.Group): void {
  const trees = [[2.2, 2.3], [18.4, 2.4], [19, 14], [3, 13.5], [6.4, 3.1], [16, 3.4]];
  for (const [x, z] of trees) {
    addTree(group, x, z);
  }
}

function addTree(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 1.58, z], [0.36, 1.12, 0.36], mat.trunk);
  addBox(group, [x, 2.35, z], [1.25, 0.82, 1.25], mat.leaf);
  addBox(group, [x - 0.36, 2.65, z + 0.18], [0.78, 0.58, 0.78], mat.leafLight);
}

function addAnimalModels(group: THREE.Group): void {
  addLion(group, 3.6, 9.2);
  addElephant(group, 4.8, 5.7);
  addMonkey(group, 17.4, 8.3);
  addMonkey(group, 19.1, 11.1);
}

function addLion(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 1.34, z], [1.0, 0.55, 0.55], mat.lion);
  addBox(group, [x - 0.58, 1.5, z], [0.58, 0.72, 0.72], mat.mane);
  addBox(group, [x - 0.72, 1.54, z], [0.34, 0.34, 0.34], mat.lion);
  addBox(group, [x + 0.58, 1.5, z], [0.14, 0.14, 0.9], mat.lion);
  addBox(group, [x - 0.32, 1.02, z - 0.22], [0.14, 0.36, 0.14], mat.mane);
  addBox(group, [x + 0.32, 1.02, z + 0.22], [0.14, 0.36, 0.14], mat.mane);
}

function addElephant(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 1.42, z], [1.15, 0.72, 0.68], mat.elephant);
  addBox(group, [x - 0.7, 1.54, z], [0.48, 0.52, 0.52], mat.elephant);
  addBox(group, [x - 1.02, 1.28, z], [0.18, 0.58, 0.18], mat.elephant);
  addBox(group, [x - 0.74, 1.62, z - 0.42], [0.12, 0.38, 0.28], mat.elephant);
  addBox(group, [x - 0.74, 1.62, z + 0.42], [0.12, 0.38, 0.28], mat.elephant);
}

function addMonkey(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 1.56, z], [0.5, 0.62, 0.42], mat.monkey);
  addBox(group, [x, 2.02, z], [0.42, 0.42, 0.42], mat.monkey);
  addBox(group, [x - 0.34, 2.04, z], [0.18, 0.2, 0.18], mat.monkey);
  addBox(group, [x + 0.34, 2.04, z], [0.18, 0.2, 0.18], mat.monkey);
  addBox(group, [x - 0.42, 1.5, z], [0.12, 0.7, 0.12], mat.monkey);
  addBox(group, [x + 0.42, 1.5, z], [0.12, 0.7, 0.12], mat.monkey);
}

function addBenches(group: THREE.Group): void {
  for (const z of [5.2]) {
    const bench = new THREE.Group();
    bench.position.set(11, 0, z);
    addLocalBox(bench, [0, 1.18, 0], [2.3, 0.2, 0.55], mat.trunk);
    addLocalBox(bench, [0, 1.55, 0.28], [2.3, 0.55, 0.12], mat.trunk);
    addLocalBox(bench, [-0.8, 0.98, 0], [0.12, 0.36, 0.12], mat.rope);
    addLocalBox(bench, [0.8, 0.98, 0], [0.12, 0.36, 0.12], mat.rope);
    group.add(bench);
  }
}
