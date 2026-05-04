import * as THREE from 'three';
import { addBox, createTextSprite } from '../../engine/renderer/ScenePrimitives.js';

const mat = {
  rug: new THREE.MeshStandardMaterial({ color: 0xef9a9a, roughness: 0.9, flatShading: true }),
  wood: new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.72, flatShading: true }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.78, flatShading: true }),
  sofa: new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.68, flatShading: true }),
  bed: new THREE.MeshStandardMaterial({ color: 0x90caf9, roughness: 0.72, flatShading: true }),
  pillow: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, flatShading: true }),
  lamp: new THREE.MeshStandardMaterial({ color: 0xfff176, roughness: 0.35, flatShading: true }),
  plant: new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.75, flatShading: true }),
  metal: new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.44, flatShading: true }),
};

export function createHomeDecor(): THREE.Group {
  const group = new THREE.Group();
  addRug(group);
  addKitchen(group);
  addDiningTable(group);
  addSofa(group);
  addBed(group);
  addLamp(group, 15.5, 13.2);
  addPlant(group, 3.1, 13.6);
  addWallFamilySign(group);
  addWarmLights(group);
  return group;
}

function addRug(group: THREE.Group): void {
  addBox(group, [10, 1.025, 10.5], [8.0, 0.035, 5.2], mat.rug);
  addBox(group, [10, 1.04, 10.5], [7.2, 0.035, 4.4], new THREE.MeshStandardMaterial({ color: 0xffccbc, roughness: 0.9 }));
}

function addKitchen(group: THREE.Group): void {
  addBox(group, [4.8, 1.42, 4.1], [5.2, 0.82, 1.0], mat.darkWood);
  addBox(group, [4.8, 1.92, 4.1], [5.5, 0.18, 1.18], mat.wood);
  addBox(group, [3.4, 2.1, 4.65], [0.75, 0.14, 0.5], mat.metal);
  addBox(group, [5.3, 2.12, 4.66], [0.54, 0.22, 0.38], mat.pillow);
}

function addDiningTable(group: THREE.Group): void {
  addBox(group, [10, 1.42, 7.2], [2.4, 0.18, 1.45], mat.wood);
  addBox(group, [9.2, 1.14, 6.75], [0.12, 0.58, 0.12], mat.darkWood);
  addBox(group, [10.8, 1.14, 6.75], [0.12, 0.58, 0.12], mat.darkWood);
  addBox(group, [9.2, 1.14, 7.65], [0.12, 0.58, 0.12], mat.darkWood);
  addBox(group, [10.8, 1.14, 7.65], [0.12, 0.58, 0.12], mat.darkWood);
  for (const x of [8.2, 11.8]) {
    addBox(group, [x, 1.12, 7.2], [0.7, 0.18, 0.62], mat.sofa);
    addBox(group, [x, 1.5, 7.2], [0.12, 0.62, 0.7], mat.sofa);
  }
}

function addSofa(group: THREE.Group): void {
  addBox(group, [6.2, 1.25, 12.0], [3.4, 0.5, 1.2], mat.sofa);
  addBox(group, [6.2, 1.72, 12.52], [3.4, 0.85, 0.16], mat.sofa);
  addBox(group, [5.0, 1.58, 11.65], [0.58, 0.42, 0.5], mat.pillow);
  addBox(group, [6.4, 1.58, 11.65], [0.58, 0.42, 0.5], mat.pillow);
}

function addBed(group: THREE.Group): void {
  addBox(group, [15.0, 1.28, 7.8], [3.3, 0.5, 2.0], mat.bed);
  addBox(group, [15.0, 1.62, 7.0], [3.0, 0.26, 0.62], mat.pillow);
  addBox(group, [15.0, 1.18, 8.92], [3.4, 1.0, 0.16], mat.darkWood);
}

function addLamp(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 1.62, z], [0.12, 1.0, 0.12], mat.metal);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.34, 24), mat.lamp);
  shade.position.set(x, 2.25, z);
  shade.castShadow = true;
  group.add(shade);
  const light = new THREE.PointLight(0xffe7a6, 0.56, 6);
  light.position.set(x, 2.1, z);
  group.add(light);
}

function addPlant(group: THREE.Group, x: number, z: number): void {
  // Low-poly pot
  const potMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.78, flatShading: true });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.42, 6), potMat);
  pot.position.set(x, 1.22, z);
  pot.castShadow = true;
  group.add(pot);
  // Low-poly foliage
  const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 0), mat.plant);
  foliage.position.set(x, 1.65, z);
  foliage.castShadow = true;
  group.add(foliage);
}

function addWallFamilySign(group: THREE.Group): void {
  const sign = createTextSprite('HOME SWEET HOME', 512, 96, '#6d4c41', 'bold 38px sans-serif');
  sign.position.set(10, 2.86, 1.02);
  sign.scale.set(4.2, 0.62, 1);
  group.add(sign);
}

function addWarmLights(group: THREE.Group): void {
  for (const x of [5, 10, 15]) {
    addBox(group, [x, 4.72, 9], [2.2, 0.08, 0.32], new THREE.MeshBasicMaterial({ color: 0xfff0c2 }));
  }
}
