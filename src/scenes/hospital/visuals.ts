import * as THREE from 'three';
import { addBox, createTextSprite } from '../../engine/renderer/ScenePrimitives.js';

const mat = {
  white: new THREE.MeshStandardMaterial({ color: 0xf8feff, roughness: 0.72 }),
  mint: new THREE.MeshStandardMaterial({ color: 0xa5f3e4, roughness: 0.62 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x64b5f6, roughness: 0.48 }),
  red: new THREE.MeshStandardMaterial({ color: 0xef5350, roughness: 0.62 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.38, metalness: 0.08 }),
  paper: new THREE.MeshStandardMaterial({ color: 0xfff8e1, roughness: 0.9 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.58 }),
};

export function createHospitalDecor(): THREE.Group {
  const group = new THREE.Group();
  addFloorPattern(group);
  addReception(group);
  addExamArea(group);
  addWaitingArea(group);
  addMedicineShelf(group);
  addWallSigns(group);
  addCeilingLights(group);
  return group;
}

function addFloorPattern(group: THREE.Group): void {
  for (let x = 2; x < 20; x += 2) addBox(group, [x, 1.025, 10.5], [1.1, 0.03, 0.12], mat.mint);
  addBox(group, [11, 1.03, 8.8], [18, 0.03, 0.16], mat.blue);
}

function addReception(group: THREE.Group): void {
  addBox(group, [11, 1.42, 5.3], [6.4, 0.84, 1.05], mat.white);
  addBox(group, [11, 1.95, 5.3], [6.7, 0.18, 1.24], mat.mint);
  addBox(group, [9.2, 2.12, 5.85], [0.8, 0.08, 0.48], mat.paper);
  addBox(group, [12.2, 2.12, 5.78], [0.46, 0.32, 0.1], mat.dark);
}

function addExamArea(group: THREE.Group): void {
  addBox(group, [16.5, 1.45, 3.4], [2.5, 0.48, 0.95], mat.blue);
  addBox(group, [16.5, 1.82, 3.18], [2.5, 0.18, 0.18], mat.white);
  addBox(group, [5.4, 1.48, 3.3], [2.0, 0.55, 0.9], mat.white);
  addBox(group, [5.4, 1.88, 3.3], [2.2, 0.16, 1.02], mat.metal);
  addBox(group, [5.4, 2.22, 3.25], [1.45, 0.42, 0.08], mat.blue);
}

function addWaitingArea(group: THREE.Group): void {
  for (const x of [5.5, 7.0, 14.8, 16.3]) {
    addBox(group, [x, 1.16, 12.4], [1.0, 0.2, 0.82], mat.blue);
    addBox(group, [x, 1.58, 12.78], [1.0, 0.7, 0.12], mat.blue);
    addBox(group, [x - 0.34, 0.98, 12.2], [0.1, 0.36, 0.1], mat.metal);
    addBox(group, [x + 0.34, 0.98, 12.2], [0.1, 0.36, 0.1], mat.metal);
  }
}

function addMedicineShelf(group: THREE.Group): void {
  addBox(group, [19.25, 2.05, 6.6], [0.34, 2.1, 3.3], mat.white);
  for (const z of [5.5, 6.4, 7.3]) addBox(group, [19.05, 1.55 + (z - 5.5) * 0.36, z], [0.42, 0.1, 2.4], mat.mint);
  for (let i = 0; i < 10; i++) {
    addBox(group, [18.82, 1.38 + (i % 3) * 0.48, 5.55 + Math.floor(i / 3) * 0.52], [0.2, 0.34, 0.18], i % 2 === 0 ? mat.red : mat.blue);
  }
}

function addWallSigns(group: THREE.Group): void {
  addBox(group, [11, 2.88, 1.05], [2.8, 1.1, 0.12], mat.red);
  const cross = createTextSprite('+ CLINIC', 384, 96, '#ffffff', 'bold 42px sans-serif');
  cross.position.set(11, 2.9, 0.96);
  cross.scale.set(2.4, 0.6, 1);
  group.add(cross);
  const advice = createTextSprite('Drink water. Take a rest.', 512, 80, '#1976d2', 'bold 32px sans-serif');
  advice.position.set(11, 3.72, 1.02);
  advice.scale.set(4.2, 0.48, 1);
  group.add(advice);
}

function addCeilingLights(group: THREE.Group): void {
  for (const x of [5, 11, 17]) {
    addBox(group, [x, 4.72, 8.8], [3.4, 0.08, 0.34], new THREE.MeshBasicMaterial({ color: 0xe0fbff }));
    const light = new THREE.PointLight(0xe0fbff, 0.42, 8);
    light.position.set(x, 4.25, 8.8);
    group.add(light);
  }
}
