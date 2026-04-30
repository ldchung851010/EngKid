import * as THREE from 'three';
import { addBox, addLocalBox, createTextSprite } from '../../engine/renderer/ScenePrimitives.js';

const mat = {
  path: new THREE.MeshStandardMaterial({ color: 0xfff0b3, roughness: 0.86 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x8d5a2b, roughness: 0.78 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x42a95b, roughness: 0.78 }),
  leafDark: new THREE.MeshStandardMaterial({ color: 0x2f8f4c, roughness: 0.82 }),
  flowerPink: new THREE.MeshStandardMaterial({ color: 0xff6fae, roughness: 0.62 }),
  flowerYellow: new THREE.MeshStandardMaterial({ color: 0xffd54f, roughness: 0.62 }),
  wood: new THREE.MeshStandardMaterial({ color: 0xa96f3b, roughness: 0.72 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x607d8b, roughness: 0.48 }),
  red: new THREE.MeshStandardMaterial({ color: 0xef5350, roughness: 0.68 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x42a5f5, roughness: 0.58 }),
  white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
};

export function createParkDecor(): THREE.Group {
  const group = new THREE.Group();
  addPathHighlights(group);
  addPond(group);
  addTree(group, 4, 13);
  addTree(group, 19, 14);
  addTree(group, 19.5, 4);
  addBench(group, 7.5, 10.6, 0);
  addBench(group, 16.5, 10.6, 0);
  addFlowerBed(group, 5.8, 7.7);
  addFlowerBed(group, 18.2, 7.6);
  addBall(group, 13.8, 8.6);
  addKite(group, 9, 5.2);
  addParkSign(group);
  return group;
}

export function animateParkDecor(visuals: THREE.Group, _delta: number, elapsed: number): void {
  visuals.traverse((child) => {
    if (child.userData.parkFloat === true) {
      child.position.y = child.userData.baseY + Math.sin(elapsed * 1.8 + child.userData.phase) * 0.12;
      child.rotation.z = Math.sin(elapsed * 1.2) * 0.08;
    }
  });
}

function addPathHighlights(group: THREE.Group): void {
  for (let z = 2; z < 18; z += 2) addBox(group, [12, 1.025, z + 0.5], [2.2, 0.03, 0.18], mat.path);
  for (let x = 4; x < 20; x += 2) addBox(group, [x + 0.5, 1.03, 10.5], [0.18, 0.03, 2.2], mat.path);
}

function addPond(group: THREE.Group): void {
  const water = new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.15, transparent: true, opacity: 0.72 });
  addBox(group, [3.9, 1.04, 4.9], [3.6, 0.06, 3.2], water);
  addBox(group, [3.9, 1.09, 4.9], [4.1, 0.08, 0.14], mat.metal);
  addBox(group, [3.9, 1.09, 3.28], [4.1, 0.08, 0.14], mat.metal);
}

function addTree(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 1.72, z], [0.45, 1.35, 0.45], mat.trunk);
  addBox(group, [x, 2.62, z], [1.55, 1.0, 1.55], mat.leaf);
  addBox(group, [x - 0.45, 3.05, z + 0.25], [1.0, 0.72, 1.0], mat.leafDark);
  addBox(group, [x + 0.42, 3.12, z - 0.2], [1.0, 0.78, 1.0], mat.leaf);
}

function addBench(group: THREE.Group, x: number, z: number, rotationY: number): void {
  const bench = new THREE.Group();
  bench.position.set(x, 0, z);
  bench.rotation.y = rotationY;
  addLocalBox(bench, [0, 1.18, 0], [2.1, 0.18, 0.58], mat.wood);
  addLocalBox(bench, [0, 1.55, 0.28], [2.1, 0.56, 0.14], mat.wood);
  addLocalBox(bench, [-0.75, 0.98, 0], [0.12, 0.42, 0.12], mat.metal);
  addLocalBox(bench, [0.75, 0.98, 0], [0.12, 0.42, 0.12], mat.metal);
  group.add(bench);
}

function addFlowerBed(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 1.08, z], [2.4, 0.16, 1.0], new THREE.MeshStandardMaterial({ color: 0x5d9f4f, roughness: 0.82 }));
  for (let i = 0; i < 8; i++) {
    addBox(group, [x - 0.9 + i * 0.28, 1.28, z + (i % 2 === 0 ? -0.18 : 0.18)], [0.16, 0.28, 0.16], i % 3 === 0 ? mat.flowerPink : mat.flowerYellow);
  }
}

function addBall(group: THREE.Group, x: number, z: number): void {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 16), mat.red);
  ball.position.set(x, 1.38, z);
  ball.castShadow = true;
  ball.userData.parkFloat = true;
  ball.userData.baseY = ball.position.y;
  ball.userData.phase = 0.3;
  group.add(ball);
  addBox(group, [x, 1.39, z], [0.08, 0.72, 0.72], mat.white);
}

function addKite(group: THREE.Group, x: number, z: number): void {
  const kite = new THREE.Group();
  kite.position.set(x, 3.2, z);
  kite.userData.parkFloat = true;
  kite.userData.baseY = 3.2;
  kite.userData.phase = 1.4;
  addLocalBox(kite, [0, 0, 0], [0.08, 0.82, 0.82], mat.blue);
  addLocalBox(kite, [0, 0, 0], [0.1, 0.1, 1.25], mat.white);
  kite.rotation.y = 0.6;
  group.add(kite);
  addBox(group, [x - 0.45, 2.35, z + 0.42], [0.04, 1.8, 0.04], mat.white);
}

function addParkSign(group: THREE.Group): void {
  addBox(group, [12, 1.8, 2.2], [3.2, 1.1, 0.14], mat.wood);
  const sign = createTextSprite('SUNNY PARK', 384, 96, '#ffffff', 'bold 38px sans-serif');
  sign.position.set(12, 1.9, 2.08);
  sign.scale.set(2.45, 0.62, 1);
  group.add(sign);
}
