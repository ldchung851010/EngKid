import * as THREE from 'three';
import { addBox, createTextPlane } from '../../engine/renderer/ScenePrimitives.js';

const mat = {
  soil: new THREE.MeshStandardMaterial({ color: 0xb9793b, roughness: 0.9, flatShading: true }),
  crop: new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.82, flatShading: true }),
  barn: new THREE.MeshStandardMaterial({ color: 0xd84315, roughness: 0.7, flatShading: true }),
  roof: new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.76, flatShading: true }),
  white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, flatShading: true }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xffd54f, roughness: 0.58, flatShading: true }),
  black: new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.6, flatShading: true }),
  metal: new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.48, flatShading: true }),
};

export function createFarmDecor(): THREE.Group {
  const group = new THREE.Group();
  addCropRows(group);
  addBarn(group);
  addAnimalPen(group);
  addTractor(group);
  addChickenCoop(group);
  addWaterTrough(group);
  addFarmSign(group);
  return group;
}

export function animateFarmDecor(visuals: THREE.Group, _delta: number, elapsed: number): void {
  visuals.traverse((child) => {
    if (child.userData.farmBob === true) {
      child.position.y = child.userData.baseY + Math.sin(elapsed * 1.6 + child.userData.phase) * 0.08;
    }
  });
}

function addCropRows(group: THREE.Group): void {
  for (const x of [4, 5.2, 6.4, 17.6, 18.8, 20]) {
    addBox(group, [x, 1.03, 8.0], [0.72, 0.04, 8.4], mat.soil);
    for (let z = 4.5; z <= 11.5; z += 1.1) addBox(group, [x, 1.28, z], [0.38, 0.42, 0.38], mat.crop);
  }
}

function addBarn(group: THREE.Group): void {
  addBox(group, [12, 1.95, 2.0], [5.4, 1.9, 1.5], mat.barn);
  addBox(group, [12, 3.08, 2.0], [6.0, 0.44, 1.85], mat.roof);
  addBox(group, [12, 1.55, 2.82], [1.5, 1.1, 0.12], mat.roof);
  const label = createTextPlane('FARM', 256, 80, '#ffffff', 'bold 36px sans-serif', 1.6, 0.48);
  label.position.set(12, 2.42, 2.9);
  group.add(label);
}

function addAnimalPen(group: THREE.Group): void {
  for (const x of [8.2, 9.4, 10.6, 13.4, 14.6, 15.8]) {
    addBox(group, [x, 1.35, 12.9], [0.1, 0.7, 0.1], mat.roof);
    addBox(group, [x, 1.35, 16.0], [0.1, 0.7, 0.1], mat.roof);
  }
  addBox(group, [12, 1.58, 12.9], [7.8, 0.1, 0.1], mat.roof);
  addBox(group, [12, 1.58, 16.0], [7.8, 0.1, 0.1], mat.roof);
  addAnimal(group, 9.4, 14.5, 'cow');
  addAnimal(group, 12.2, 14.6, 'sheep');
  addAnimal(group, 14.8, 14.4, 'cow');
}

function addAnimal(group: THREE.Group, x: number, z: number, kind: 'cow' | 'sheep'): void {
  const animal = new THREE.Group();
  animal.position.set(x, 0, z);
  animal.userData.farmBob = true;
  animal.userData.baseY = 0;
  animal.userData.phase = x;
  const bodyMat = kind === 'cow' ? mat.white : new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 });
  addBox(animal, [0, 1.28, 0], [0.95, 0.55, 0.48], bodyMat);
  addBox(animal, [0.52, 1.42, 0], [0.34, 0.34, 0.34], bodyMat);
  addBox(animal, [-0.25, 0.93, -0.16], [0.1, 0.34, 0.1], mat.black);
  addBox(animal, [0.25, 0.93, -0.16], [0.1, 0.34, 0.1], mat.black);
  addBox(animal, [-0.25, 0.93, 0.16], [0.1, 0.34, 0.1], mat.black);
  addBox(animal, [0.25, 0.93, 0.16], [0.1, 0.34, 0.1], mat.black);
  group.add(animal);
}

function addTractor(group: THREE.Group): void {
  addBox(group, [6.4, 1.38, 15.2], [1.5, 0.8, 1.0], mat.yellow);
  addBox(group, [6.85, 1.95, 15.2], [0.72, 0.7, 0.72], mat.metal);
  for (const dx of [-0.65, 0.65]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.22, 24), mat.black);
    wheel.position.set(6.4 + dx, 1.05, 15.75);
    wheel.rotation.z = Math.PI / 2;
    group.add(wheel);
  }
}

function addChickenCoop(group: THREE.Group): void {
  addBox(group, [18.5, 1.45, 15.2], [2.2, 0.9, 1.3], mat.barn);
  addBox(group, [18.5, 2.1, 15.2], [2.4, 0.34, 1.45], mat.roof);
  for (const x of [17.9, 18.5, 19.1]) {
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), mat.white);
    egg.position.set(x, 1.92, 14.5);
    group.add(egg);
  }
}

function addWaterTrough(group: THREE.Group): void {
  addBox(group, [15.9, 1.12, 12.1], [1.8, 0.35, 0.62], mat.metal);
  addBox(group, [15.9, 1.32, 12.1], [1.55, 0.06, 0.42], new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.2 }));
}

function addFarmSign(group: THREE.Group): void {
  const sign = createTextPlane('HELLO FARMER', 512, 96, '#5d4037', 'bold 40px sans-serif', 3.8, 0.58);
  sign.position.set(12, 2.25, 6.0);
  group.add(sign);
}
