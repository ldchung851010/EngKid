import * as THREE from 'three';
import { addBox, addLocalBox, createTextSprite } from '../../engine/renderer/ScenePrimitives.js';

const mat = {
  trunk: new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.82, flatShading: true }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.92, flatShading: true }),
  leafLight: new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.92, flatShading: true }),
  fence: new THREE.MeshStandardMaterial({ color: 0xffcc80, roughness: 0.78, flatShading: true }),
  rope: new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.72, flatShading: true }),
  sign: new THREE.MeshStandardMaterial({ color: 0xffe082, roughness: 0.55, flatShading: true }),
  stone: new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.82, flatShading: true }),
  lion: new THREE.MeshStandardMaterial({ color: 0xffb74d, roughness: 0.76, flatShading: true }),
  mane: new THREE.MeshStandardMaterial({ color: 0x8d4b2d, roughness: 0.8, flatShading: true }),
  monkey: new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.78, flatShading: true }),
  elephant: new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.78, flatShading: true }),
  water: new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.25, transparent: true, opacity: 0.72, flatShading: true }),
  grassSnack: new THREE.MeshStandardMaterial({ color: 0x8bc34a, roughness: 0.86, flatShading: true }),
};

type ZooAnimalKind = 'lion' | 'elephant' | 'monkey';

interface ZooAnimalState {
  kind: ZooAnimalKind;
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
}

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

export function animateZooDecor(group: THREE.Group, _delta: number, elapsed: number): void {
  group.children.forEach((child) => {
    const state = child.userData.zooAnimal as ZooAnimalState | undefined;
    if (!state) return;

    switch (state.kind) {
      case 'lion':
        animateLion(child, state, elapsed);
        break;
      case 'elephant':
        animateElephant(child, state, elapsed);
        break;
      case 'monkey':
        animateMonkey(child, state, elapsed);
        break;
    }
  });
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
  // Low-poly trunk (cylinder, 6 segments)
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.5, 6), mat.trunk);
  trunk.position.set(x, 1.75, z);
  trunk.castShadow = true;
  group.add(trunk);
  // Low-poly foliage (stacked cones, 6 segments)
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.0, 6), mat.leaf);
  c1.position.set(x, 2.6, z);
  c1.castShadow = true;
  group.add(c1);
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.8, 6), mat.leafLight);
  c2.position.set(x, 3.1, z);
  c2.castShadow = true;
  group.add(c2);
}

function addAnimalModels(group: THREE.Group): void {
  addLion(group, 3.6, 9.2);
  addElephant(group, 4.8, 5.7);
  addMonkey(group, 17.4, 8.3);
  addMonkey(group, 19.1, 11.1);
}

function addLion(group: THREE.Group, x: number, z: number): void {
  const lion = createAnimalGroup('lion', x, z, 0.6);
  addAnimalBox(lion, 'body', [0, 1.34, 0], [1.0, 0.55, 0.55], mat.lion);
  addAnimalBox(lion, 'mane', [-0.58, 1.5, 0], [0.58, 0.72, 0.72], mat.mane);
  addAnimalBox(lion, 'head', [-0.72, 1.54, 0], [0.34, 0.34, 0.34], mat.lion);
  addAnimalBox(lion, 'tail', [0.58, 1.5, 0], [0.14, 0.14, 0.9], mat.lion);
  addAnimalBox(lion, 'frontLeg', [-0.32, 1.02, -0.22], [0.14, 0.36, 0.14], mat.mane);
  addAnimalBox(lion, 'backLeg', [0.32, 1.02, 0.22], [0.14, 0.36, 0.14], mat.mane);
  group.add(lion);
}

function addElephant(group: THREE.Group, x: number, z: number): void {
  const elephant = createAnimalGroup('elephant', x, z, 1.9);
  addAnimalBox(elephant, 'body', [0, 1.42, 0], [1.15, 0.72, 0.68], mat.elephant);
  addAnimalBox(elephant, 'head', [-0.7, 1.54, 0], [0.48, 0.52, 0.52], mat.elephant);
  addAnimalBox(elephant, 'trunk', [-1.02, 1.28, 0], [0.18, 0.58, 0.18], mat.elephant);
  addAnimalBox(elephant, 'leftEar', [-0.74, 1.62, -0.42], [0.12, 0.38, 0.28], mat.elephant);
  addAnimalBox(elephant, 'rightEar', [-0.74, 1.62, 0.42], [0.12, 0.38, 0.28], mat.elephant);
  addAnimalBox(elephant, 'snack', [-1.15, 1.04, 0.12], [0.34, 0.08, 0.22], mat.grassSnack);
  group.add(elephant);
}

function addMonkey(group: THREE.Group, x: number, z: number): void {
  const monkey = createAnimalGroup('monkey', x, z, x * 0.21 + z * 0.13);
  addAnimalBox(monkey, 'body', [0, 1.56, 0], [0.5, 0.62, 0.42], mat.monkey);
  addAnimalBox(monkey, 'head', [0, 2.02, 0], [0.42, 0.42, 0.42], mat.monkey);
  addAnimalBox(monkey, 'leftEar', [-0.34, 2.04, 0], [0.18, 0.2, 0.18], mat.monkey);
  addAnimalBox(monkey, 'rightEar', [0.34, 2.04, 0], [0.18, 0.2, 0.18], mat.monkey);
  addAnimalBox(monkey, 'leftArm', [-0.42, 1.5, 0], [0.12, 0.7, 0.12], mat.monkey);
  addAnimalBox(monkey, 'rightArm', [0.42, 1.5, 0], [0.12, 0.7, 0.12], mat.monkey);
  addAnimalBox(monkey, 'leftLeg', [-0.18, 1.12, -0.08], [0.14, 0.38, 0.14], mat.monkey);
  addAnimalBox(monkey, 'rightLeg', [0.18, 1.12, -0.08], [0.14, 0.38, 0.14], mat.monkey);
  addAnimalBox(monkey, 'leftFoot', [-0.18, 0.92, -0.26], [0.22, 0.1, 0.34], mat.monkey);
  addAnimalBox(monkey, 'rightFoot', [0.18, 0.92, -0.26], [0.22, 0.1, 0.34], mat.monkey);
  const tailBase = addAnimalBox(monkey, 'tailBase', [0, 1.52, 0.38], [0.1, 0.1, 0.42], mat.monkey);
  const tailMid = addAnimalBox(monkey, 'tailMid', [0, 1.82, 0.58], [0.1, 0.46, 0.1], mat.monkey);
  const tailTip = addAnimalBox(monkey, 'tailTip', [0, 2.1, 0.46], [0.1, 0.1, 0.32], mat.monkey);
  tailBase.rotation.x = -0.32;
  tailMid.rotation.x = -0.12;
  tailTip.rotation.x = 0.42;
  group.add(monkey);
}

function createAnimalGroup(kind: ZooAnimalKind, x: number, z: number, phase: number): THREE.Group {
  const animal = new THREE.Group();
  animal.position.set(x, 0, z);
  animal.userData.zooAnimal = { kind, baseX: x, baseY: 0, baseZ: z, phase } satisfies ZooAnimalState;
  return animal;
}

function addAnimalBox(
  parent: THREE.Object3D,
  part: string,
  position: [number, number, number],
  scale: [number, number, number],
  material: THREE.Material,
): THREE.Mesh {
  const mesh = addLocalBox(parent, position, scale, material);
  mesh.userData.collidable = false;
  mesh.userData.zooAnimalPart = part;
  return mesh;
}

function getAnimalPart(animal: THREE.Object3D, part: string): THREE.Object3D | undefined {
  return animal.children.find((child) => child.userData.zooAnimalPart === part);
}

function animateLion(animal: THREE.Object3D, state: ZooAnimalState, elapsed: number): void {
  const t = elapsed * 0.72 + state.phase;
  animal.position.x = state.baseX + Math.sin(t) * 0.5;
  animal.position.z = state.baseZ + Math.sin(t * 0.55) * 0.16;
  animal.position.y = state.baseY + Math.sin(t * 3.2) * 0.025;
  animal.rotation.y = Math.sin(t) * 0.18;

  const head = getAnimalPart(animal, 'head');
  const mane = getAnimalPart(animal, 'mane');
  const tail = getAnimalPart(animal, 'tail');
  const frontLeg = getAnimalPart(animal, 'frontLeg');
  const backLeg = getAnimalPart(animal, 'backLeg');
  const nod = Math.sin(t * 2.3) * 0.07;
  if (head) head.position.y = 1.54 + nod;
  if (mane) mane.position.y = 1.5 + nod * 0.5;
  if (tail) tail.rotation.x = Math.sin(t * 4.2) * 0.45;
  if (frontLeg) frontLeg.rotation.z = Math.sin(t * 4.4) * 0.24;
  if (backLeg) backLeg.rotation.z = -Math.sin(t * 4.4) * 0.24;
}

function animateElephant(animal: THREE.Object3D, state: ZooAnimalState, elapsed: number): void {
  const t = elapsed * 0.9 + state.phase;
  const graze = (Math.sin(t) + 1) * 0.5;
  animal.position.x = state.baseX + Math.sin(t * 0.45) * 0.1;
  animal.position.y = state.baseY + Math.sin(t * 1.6) * 0.015;
  animal.rotation.y = -0.08 + Math.sin(t * 0.45) * 0.05;

  const head = getAnimalPart(animal, 'head');
  const trunk = getAnimalPart(animal, 'trunk');
  const leftEar = getAnimalPart(animal, 'leftEar');
  const rightEar = getAnimalPart(animal, 'rightEar');
  if (head) head.position.y = 1.54 - graze * 0.22;
  if (trunk) {
    trunk.position.y = 1.28 - graze * 0.18;
    trunk.rotation.z = Math.sin(t * 2.5) * 0.22;
  }
  if (leftEar) leftEar.rotation.x = Math.sin(t * 2.1) * 0.18;
  if (rightEar) rightEar.rotation.x = -Math.sin(t * 2.1) * 0.18;
}

function animateMonkey(animal: THREE.Object3D, state: ZooAnimalState, elapsed: number): void {
  const t = elapsed * 1.7 + state.phase;
  animal.position.y = state.baseY + Math.abs(Math.sin(t * 1.5)) * 0.16;
  animal.rotation.z = Math.sin(t) * 0.08;
  animal.rotation.y = Math.sin(t * 0.6) * 0.24;

  const head = getAnimalPart(animal, 'head');
  const leftArm = getAnimalPart(animal, 'leftArm');
  const rightArm = getAnimalPart(animal, 'rightArm');
  const leftLeg = getAnimalPart(animal, 'leftLeg');
  const rightLeg = getAnimalPart(animal, 'rightLeg');
  const leftFoot = getAnimalPart(animal, 'leftFoot');
  const rightFoot = getAnimalPart(animal, 'rightFoot');
  const tailBase = getAnimalPart(animal, 'tailBase');
  const tailMid = getAnimalPart(animal, 'tailMid');
  const tailTip = getAnimalPart(animal, 'tailTip');
  if (head) head.position.y = 2.02 + Math.sin(t * 2.4) * 0.06;
  if (leftArm) leftArm.rotation.z = Math.sin(t * 3) * 0.35;
  if (rightArm) rightArm.rotation.z = -Math.sin(t * 3) * 0.35;
  if (leftLeg) leftLeg.rotation.z = -Math.sin(t * 3) * 0.18;
  if (rightLeg) rightLeg.rotation.z = Math.sin(t * 3) * 0.18;
  if (leftFoot) leftFoot.rotation.x = Math.sin(t * 3.2) * 0.14;
  if (rightFoot) rightFoot.rotation.x = -Math.sin(t * 3.2) * 0.14;
  if (tailBase) tailBase.rotation.y = Math.sin(t * 2.1) * 0.22;
  if (tailMid) tailMid.rotation.z = Math.sin(t * 2.1 + 0.5) * 0.2;
  if (tailTip) tailTip.rotation.y = Math.sin(t * 2.1 + 1) * 0.28;
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
