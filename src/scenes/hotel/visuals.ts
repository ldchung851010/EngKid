import * as THREE from 'three';
import { addBox, addLocalBox, createTextSprite } from '../../engine/renderer/ScenePrimitives.js';

const mat = {
  marble: new THREE.MeshStandardMaterial({ color: 0xfff8e1, roughness: 0.46, flatShading: true }),
  marbleAlt: new THREE.MeshStandardMaterial({ color: 0xf5e6ca, roughness: 0.52, flatShading: true }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffca28, roughness: 0.34, metalness: 0.05, flatShading: true }),
  walnut: new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.72, flatShading: true }),
  wood: new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.7, flatShading: true }),
  sofaBlue: new THREE.MeshStandardMaterial({ color: 0x3949ab, roughness: 0.74, flatShading: true }),
  sofaGreen: new THREE.MeshStandardMaterial({ color: 0x00796b, roughness: 0.74, flatShading: true }),
  plant: new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.82, flatShading: true }),
  pot: new THREE.MeshStandardMaterial({ color: 0xc77745, roughness: 0.72, flatShading: true }),
  glass: new THREE.MeshStandardMaterial({ color: 0xb3e5fc, roughness: 0.24, transparent: true, opacity: 0.68, flatShading: true }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.38, metalness: 0.08, flatShading: true }),
  dark: new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.52, flatShading: true }),
  red: new THREE.MeshStandardMaterial({ color: 0xef5350, roughness: 0.72, flatShading: true }),
};

export function createHotelDecor(): THREE.Group {
  const group = new THREE.Group();

  addFloorPattern(group);
  addReception(group);
  addLobbySign(group);
  addSofasAndTables(group);
  addElevators(group);
  addLuggageCart(group);
  addPlants(group);
  addChandeliers(group);
  addWallArt(group);
  addKeyDisplay(group);

  return group;
}

function addFloorPattern(group: THREE.Group): void {
  for (let x = 1; x < 19; x++) {
    for (let z = 2; z < 17; z++) {
      if ((x + z) % 3 === 0) {
        addBox(group, [x + 0.5, 1.018, z + 0.5], [0.9, 0.025, 0.9], (x + z) % 2 === 0 ? mat.marble : mat.marbleAlt);
      }
    }
  }
  addBox(group, [10, 1.035, 11.6], [3.2, 0.03, 8.4], new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.92 }));
  addBox(group, [10, 1.055, 11.6], [2.35, 0.025, 7.4], new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.9 }));
}

function addReception(group: THREE.Group): void {
  addBox(group, [10, 1.42, 4.38], [11.2, 0.92, 1.15], mat.walnut);
  addBox(group, [10, 1.96, 4.38], [11.55, 0.18, 1.32], mat.gold);
  addBox(group, [10, 2.22, 3.76], [10.6, 0.34, 0.16], mat.marble);
  for (const x of [6.5, 10, 13.5]) {
    addBox(group, [x, 2.36, 4.96], [0.88, 0.08, 0.52], mat.marbleAlt);
    addBox(group, [x + 0.28, 2.48, 4.86], [0.38, 0.22, 0.08], mat.dark);
  }
}

function addLobbySign(group: THREE.Group): void {
  addBox(group, [10, 3.18, 1.05], [5.8, 1.28, 0.14], mat.gold);
  addBox(group, [10, 3.18, 0.96], [5.25, 0.96, 0.08], mat.walnut);
  const sign = createTextSprite('SUNNY HOTEL', 512, 128, '#fff8e1', 'bold 50px sans-serif');
  sign.position.set(10, 3.22, 0.88);
  sign.scale.set(3.9, 0.78, 1);
  group.add(sign);
}

function addSofasAndTables(group: THREE.Group): void {
  addSofa(group, 3.3, 11.2, mat.sofaBlue, Math.PI / 2);
  addSofa(group, 6.1, 12.8, mat.sofaGreen, -Math.PI / 2);
  addCoffeeTable(group, 4.75, 12);

  addSofa(group, 16.7, 11.2, mat.sofaGreen, -Math.PI / 2);
  addSofa(group, 13.9, 12.8, mat.sofaBlue, Math.PI / 2);
  addCoffeeTable(group, 15.25, 12);
}

function addSofa(group: THREE.Group, x: number, z: number, material: THREE.Material, rotationY: number): void {
  const sofa = new THREE.Group();
  sofa.position.set(x, 0, z);
  sofa.rotation.y = rotationY;
  addLocalBox(sofa, [0, 1.18, 0], [2.45, 0.38, 0.92], material);
  addLocalBox(sofa, [0, 1.68, 0.38], [2.45, 0.86, 0.18], material);
  addLocalBox(sofa, [-1.18, 1.45, 0], [0.18, 0.62, 0.92], material);
  addLocalBox(sofa, [1.18, 1.45, 0], [0.18, 0.62, 0.92], material);
  addLocalBox(sofa, [-0.55, 1.5, -0.18], [0.54, 0.28, 0.18], mat.marbleAlt);
  addLocalBox(sofa, [0.55, 1.5, -0.18], [0.54, 0.28, 0.18], mat.gold);
  group.add(sofa);
}

function addCoffeeTable(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 1.28, z], [2.1, 0.18, 1.15], mat.glass);
  addBox(group, [x - 0.72, 1.03, z - 0.38], [0.12, 0.48, 0.12], mat.gold);
  addBox(group, [x + 0.72, 1.03, z - 0.38], [0.12, 0.48, 0.12], mat.gold);
  addBox(group, [x - 0.72, 1.03, z + 0.38], [0.12, 0.48, 0.12], mat.gold);
  addBox(group, [x + 0.72, 1.03, z + 0.38], [0.12, 0.48, 0.12], mat.gold);
  addBox(group, [x, 1.42, z], [0.58, 0.08, 0.42], mat.red);
}

function addElevators(group: THREE.Group): void {
  for (const x of [2.5, 17.5]) {
    addBox(group, [x, 2.35, 1.04], [2.15, 2.35, 0.12], mat.metal);
    addBox(group, [x, 2.32, 0.94], [1.76, 2.08, 0.08], mat.dark);
    addBox(group, [x, 3.62, 0.88], [1.25, 0.38, 0.08], mat.gold);
  }
  const left = createTextSprite('LIFT', 128, 64, '#fff8e1', 'bold 28px sans-serif');
  left.position.set(2.5, 3.64, 0.82);
  left.scale.set(0.9, 0.36, 1);
  group.add(left);
  const right = createTextSprite('LIFT', 128, 64, '#fff8e1', 'bold 28px sans-serif');
  right.position.set(17.5, 3.64, 0.82);
  right.scale.set(0.9, 0.36, 1);
  group.add(right);
}

function addLuggageCart(group: THREE.Group): void {
  addBox(group, [15.6, 1.35, 7.2], [1.35, 0.1, 0.75], mat.gold);
  addBox(group, [15.05, 1.85, 7.2], [0.12, 1.0, 0.12], mat.gold);
  addBox(group, [16.15, 1.85, 7.2], [0.12, 1.0, 0.12], mat.gold);
  addBox(group, [15.6, 2.35, 7.2], [1.3, 0.12, 0.12], mat.gold);
  addBox(group, [15.4, 1.62, 7.2], [0.52, 0.55, 0.38], mat.red);
  addBox(group, [15.98, 1.55, 7.22], [0.44, 0.42, 0.32], mat.sofaBlue);
  addBox(group, [15.1, 1.02, 6.85], [0.12, 0.12, 0.12], mat.dark);
  addBox(group, [16.1, 1.02, 6.85], [0.12, 0.12, 0.12], mat.dark);
}

function addPlants(group: THREE.Group): void {
  for (const [x, z] of [[2.2, 5.8], [17.8, 5.8], [2.2, 15.4], [17.8, 15.4]]) {
    // Low-poly pot (cylinder)
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.46, 6), mat.pot);
    pot.position.set(x, 1.24, z);
    pot.castShadow = true;
    group.add(pot);
    // Low-poly foliage (dodecahedron)
    const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), mat.plant);
    foliage.position.set(x, 1.72, z);
    foliage.castShadow = true;
    group.add(foliage);
    const foliage2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), mat.plant);
    foliage2.position.set(x - 0.2, 1.95, z + 0.1);
    foliage2.castShadow = true;
    group.add(foliage2);
  }
}

function addChandeliers(group: THREE.Group): void {
  for (const [x, z] of [[7, 8.5], [13, 8.5], [10, 13.2]]) {
    addBox(group, [x, 4.62, z], [0.08, 0.7, 0.08], mat.gold);
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.3, 0.32, 24),
      mat.gold
    );
    shade.position.set(x, 4.08, z);
    shade.castShadow = true;
    group.add(shade);
    const light = new THREE.PointLight(0xfff1c4, 0.55, 6);
    light.position.set(x, 3.82, z);
    group.add(light);
  }
}

function addWallArt(group: THREE.Group): void {
  addBox(group, [1.04, 2.62, 10.4], [0.1, 1.25, 1.75], mat.gold);
  addBox(group, [18.96, 2.62, 10.4], [0.1, 1.25, 1.75], mat.gold);
  addBox(group, [1.0, 2.62, 10.4], [0.06, 0.92, 1.35], mat.glass);
  addBox(group, [19.0, 2.62, 10.4], [0.06, 0.92, 1.35], mat.glass);
}

function addKeyDisplay(group: THREE.Group): void {
  addBox(group, [5.2, 2.65, 1.03], [2.1, 1.2, 0.1], mat.walnut);
  for (let i = 0; i < 9; i++) {
    const x = 4.45 + (i % 3) * 0.38;
    const y = 2.28 + Math.floor(i / 3) * 0.34;
    addBox(group, [x, y, 0.94], [0.16, 0.08, 0.04], mat.gold);
  }
}
