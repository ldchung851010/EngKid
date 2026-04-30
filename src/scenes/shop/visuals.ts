import * as THREE from 'three';
import { addBox, createTextSprite } from '../../engine/renderer/ScenePrimitives.js';

const mat = {
  shelf: new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.72 }),
  wood: new THREE.MeshStandardMaterial({ color: 0xb77945, roughness: 0.68 }),
  counter: new THREE.MeshStandardMaterial({ color: 0xffb74d, roughness: 0.58 }),
  red: new THREE.MeshStandardMaterial({ color: 0xef5350, roughness: 0.62 }),
  green: new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.72 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x42a5f5, roughness: 0.58 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xffd54f, roughness: 0.56 }),
  white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.52 }),
};

export function createShopDecor(): THREE.Group {
  const group = new THREE.Group();
  addShopSign(group);
  addCounter(group);
  addShelf(group, 2.0, 7.5);
  addShelf(group, 20.0, 7.5);
  addProduceTable(group, 6.0, 10.8);
  addToyTable(group, 16.0, 10.8);
  addFloorArrows(group);
  addBasketStack(group);
  addCeilingLights(group);
  return group;
}

function addShopSign(group: THREE.Group): void {
  addBox(group, [11, 2.85, 1.04], [5.6, 1.15, 0.12], mat.yellow);
  const sign = createTextSprite('HAPPY SHOP', 512, 96, '#5d4037', 'bold 44px sans-serif');
  sign.position.set(11, 2.88, 0.94);
  sign.scale.set(3.8, 0.62, 1);
  group.add(sign);
}

function addCounter(group: THREE.Group): void {
  addBox(group, [11, 1.42, 5.4], [6.8, 0.82, 1.05], mat.counter);
  addBox(group, [11, 1.95, 5.4], [7.0, 0.18, 1.24], mat.wood);
  addBox(group, [13.2, 2.14, 5.8], [0.6, 0.24, 0.38], mat.dark);
  addBox(group, [12.85, 2.34, 5.62], [0.4, 0.26, 0.08], mat.blue);
  addBox(group, [9.2, 2.08, 5.85], [0.55, 0.08, 0.42], mat.white);
}

function addShelf(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 2.05, z], [0.36, 2.1, 5.0], mat.shelf);
  for (const y of [1.35, 1.85, 2.35]) addBox(group, [x, y, z], [0.45, 0.1, 4.75], mat.wood);
  const colors = [mat.red, mat.green, mat.blue, mat.yellow, mat.white];
  for (let i = 0; i < 21; i++) {
    addBox(group, [x - 0.18, 1.48 + Math.floor(i / 7) * 0.5, z - 2 + (i % 7) * 0.62], [0.3, 0.34, 0.22], colors[i % colors.length]);
  }
}

function addProduceTable(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 1.35, z], [3.2, 0.32, 1.55], mat.wood);
  for (let i = 0; i < 10; i++) {
    const apple = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), i % 2 === 0 ? mat.red : mat.green);
    apple.position.set(x - 1.25 + (i % 5) * 0.55, 1.62, z - 0.3 + Math.floor(i / 5) * 0.5);
    apple.castShadow = true;
    group.add(apple);
  }
}

function addToyTable(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 1.35, z], [3.2, 0.32, 1.55], mat.wood);
  addBox(group, [x - 0.8, 1.68, z], [0.55, 0.55, 0.55], mat.blue);
  addBox(group, [x, 1.68, z], [0.55, 0.55, 0.55], mat.yellow);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), mat.red);
  ball.position.set(x + 0.8, 1.7, z);
  ball.castShadow = true;
  group.add(ball);
}

function addFloorArrows(group: THREE.Group): void {
  for (const z of [8, 12, 15]) addBox(group, [11, 1.03, z], [3.2, 0.03, 0.16], mat.yellow);
}

function addBasketStack(group: THREE.Group): void {
  addBox(group, [18.2, 1.25, 14.6], [1.0, 0.42, 0.72], mat.red);
  addBox(group, [18.2, 1.55, 14.6], [0.9, 0.32, 0.62], mat.red);
}

function addCeilingLights(group: THREE.Group): void {
  for (const x of [5, 11, 17]) {
    addBox(group, [x, 4.72, 8.6], [3.4, 0.08, 0.34], new THREE.MeshBasicMaterial({ color: 0xfff6d0 }));
    const light = new THREE.PointLight(0xfff1c4, 0.44, 8);
    light.position.set(x, 4.25, 8.6);
    group.add(light);
  }
}
