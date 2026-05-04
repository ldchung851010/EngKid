import * as THREE from 'three';
import { addBox, addLocalBox, createTextPlane } from '../../engine/renderer/ScenePrimitives.js';

const mat = {
  sand: new THREE.MeshStandardMaterial({ color: 0xffe0a3, roughness: 0.92, flatShading: true }),
  water: new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.18, transparent: true, opacity: 0.7, flatShading: true }),
  red: new THREE.MeshStandardMaterial({ color: 0xef5350, roughness: 0.6, flatShading: true }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xffd54f, roughness: 0.55, flatShading: true }),
  blue: new THREE.MeshStandardMaterial({ color: 0x42a5f5, roughness: 0.5, flatShading: true }),
  white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, flatShading: true }),
  wood: new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.76, flatShading: true }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.78, flatShading: true }),
};

export function createBeachDecor(): THREE.Group {
  const group = new THREE.Group();
  addWaterSurface(group);
  addUmbrella(group, 6.5, 11.4);
  addUmbrella(group, 17.5, 12.1);
  addTowel(group, 7.2, 14.2, mat.blue);
  addTowel(group, 16.8, 14.8, mat.red);
  addSandcastle(group, 12, 12.2);
  addShells(group);
  addLifeguardChair(group);
  addPalm(group, 3.4, 8.6);
  addPalm(group, 20.4, 8.4);
  addBeachSign(group);
  return group;
}

export function animateBeachDecor(visuals: THREE.Group, _delta: number, elapsed: number): void {
  visuals.traverse((child) => {
    if (child.userData.wave === true) {
      child.position.y = child.userData.baseY + Math.sin(elapsed * 2 + child.userData.phase) * 0.04;
    }
  });
}

function addWaterSurface(group: THREE.Group): void {
  for (let z = 0; z < 6; z++) {
    const strip = addBox(group, [12, 1.035, z + 0.5], [22, 0.04, 0.7], mat.water);
    strip.userData.wave = true;
    strip.userData.baseY = strip.position.y;
    strip.userData.phase = z * 0.5;
  }
}

function addUmbrella(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 1.75, z], [0.12, 1.5, 0.12], mat.wood);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.58, 8), mat.yellow);
  shade.position.set(x, 2.58, z);
  shade.castShadow = true;
  group.add(shade);
}

function addTowel(group: THREE.Group, x: number, z: number, material: THREE.Material): void {
  addBox(group, [x, 1.04, z], [2.2, 0.04, 1.25], material);
  addBox(group, [x, 1.07, z], [0.16, 0.04, 1.25], mat.white);
}

function addSandcastle(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 1.28, z], [1.6, 0.5, 1.1], mat.sand);
  for (const dx of [-0.55, 0, 0.55]) addBox(group, [x + dx, 1.68, z - 0.28], [0.34, 0.42, 0.34], mat.sand);
}

function addShells(group: THREE.Group): void {
  for (const [x, z] of [[9.2, 9.8], [14.8, 10.2], [5.4, 15.2], [18.4, 16.1]]) {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 8, 0, Math.PI), mat.white);
    shell.position.set(x, 1.16, z);
    shell.rotation.x = Math.PI / 2;
    shell.castShadow = true;
    group.add(shell);
  }
}

function addLifeguardChair(group: THREE.Group): void {
  addBox(group, [12, 1.85, 7.0], [1.2, 0.22, 1.0], mat.red);
  addBox(group, [12, 2.35, 7.42], [1.2, 0.7, 0.14], mat.red);
  addBox(group, [11.55, 1.32, 6.7], [0.12, 1.0, 0.12], mat.wood);
  addBox(group, [12.45, 1.32, 6.7], [0.12, 1.0, 0.12], mat.wood);
  const buoy = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.08, 12, 24), mat.white);
  buoy.position.set(12.85, 2.1, 7.0);
  buoy.rotation.y = Math.PI / 2;
  group.add(buoy);
}

function addPalm(group: THREE.Group, x: number, z: number): void {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  tree.rotation.z = x < 12 ? -0.12 : 0.12;
  // Low-poly trunk (cylinder, 6 segments)
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 2.2, 6), mat.wood);
  trunk.position.set(0, 1.9, 0);
  trunk.castShadow = true;
  tree.add(trunk);
  // Low-poly palm fronds (cones radiating outward)
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 4), mat.leaf);
    frond.position.set(Math.cos(angle) * 0.35, 3.0, Math.sin(angle) * 0.35);
    frond.rotation.z = Math.cos(angle) * 0.6;
    frond.rotation.x = Math.sin(angle) * 0.6;
    frond.castShadow = true;
    tree.add(frond);
  }
  group.add(tree);
}

function addBeachSign(group: THREE.Group): void {
  const sign = createTextPlane('SUNNY BEACH', 512, 96, '#ffffff', 'bold 42px sans-serif', 3.7, 0.62);
  sign.position.set(12, 2.35, 6.05);
  group.add(sign);
}
