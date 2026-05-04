import * as THREE from 'three';
import { addBox, createTextPlane } from '../../engine/renderer/ScenePrimitives.js';

const mat = {
  chalkboard: new THREE.MeshStandardMaterial({ color: 0x1f6f43, roughness: 0.62, flatShading: true }),
  chalkTray: new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.52, flatShading: true }),
  wood: new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.72, flatShading: true }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.78, flatShading: true }),
  chairBlue: new THREE.MeshStandardMaterial({ color: 0x42a5f5, roughness: 0.66, flatShading: true }),
  chairLeg: new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.68, flatShading: true }),
  paper: new THREE.MeshStandardMaterial({ color: 0xfff8e1, roughness: 0.9, flatShading: true }),
  red: new THREE.MeshStandardMaterial({ color: 0xef5350, roughness: 0.65, flatShading: true }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xffd54f, roughness: 0.65, flatShading: true }),
  green: new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.75, flatShading: true }),
  purple: new THREE.MeshStandardMaterial({ color: 0x7e57c2, roughness: 0.65, flatShading: true }),
  metal: new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.44, flatShading: true }),
};

export function createSchoolDecor(): THREE.Group {
  const group = new THREE.Group();

  addFloorTiles(group);
  addBlackboardWall(group);
  addTeacherDesk(group);
  addStudentDesks(group);
  addBookshelf(group, 1.2, 7.5);
  addBookshelf(group, 18.8, 7.5);
  addBulletinBoard(group, 3.2, 1.02, 'OUR CLASS');
  addBulletinBoard(group, 16.8, 1.02, 'WORDS');
  addAlphabetBanner(group);
  addDoorAndWindows(group);

  return group;
}

function addFloorTiles(group: THREE.Group): void {
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff3d7, roughness: 0.86 });
  const mint = new THREE.MeshStandardMaterial({ color: 0xd7f4e6, roughness: 0.86 });
  for (let x = 1; x < 19; x++) {
    for (let z = 2; z < 15; z++) {
      if ((x + z) % 2 === 0) {
        addBox(group, [x + 0.5, 1.015, z + 0.5], [0.92, 0.025, 0.92], (x + z) % 4 === 0 ? cream : mint);
      }
    }
  }
}

function addBlackboardWall(group: THREE.Group): void {
  addBox(group, [10, 2.45, 1.04], [7.2, 1.75, 0.12], mat.chalkboard);
  addBox(group, [10, 1.52, 0.96], [7.4, 0.08, 0.18], mat.chalkTray);
  addBox(group, [6.25, 2.45, 1], [0.14, 1.95, 0.18], mat.darkWood);
  addBox(group, [13.75, 2.45, 1], [0.14, 1.95, 0.18], mat.darkWood);
  addBox(group, [10, 3.4, 1], [7.65, 0.14, 0.18], mat.darkWood);

  const abc = createTextPlane('ABC  123', 512, 128, '#ffffff', 'bold 54px sans-serif', 3.5, 0.78);
  abc.position.set(10, 2.68, 1.11);
  group.add(abc);

  const prompt = createTextPlane('Can I have a pencil?', 512, 96, '#fff9c4', 'bold 34px sans-serif', 3.7, 0.62);
  prompt.position.set(10, 2.08, 1.11);
  group.add(prompt);
}

function addTeacherDesk(group: THREE.Group): void {
  addBox(group, [10, 1.45, 3.75], [3.8, 0.68, 1.1], mat.darkWood);
  addBox(group, [10, 1.88, 3.75], [4.05, 0.18, 1.25], mat.wood);
  addBox(group, [8.7, 2.05, 3.52], [0.72, 0.08, 0.48], mat.paper);
  addBox(group, [11.2, 2.08, 3.6], [0.55, 0.14, 0.18], mat.red);
  addBox(group, [11.25, 2.22, 3.6], [0.5, 0.12, 0.16], mat.yellow);
  addGlobe(group, 12.3, 3.65);
}

function addGlobe(group: THREE.Group, x: number, z: number): void {
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.35 })
  );
  globe.position.set(x, 2.25, z);
  globe.castShadow = true;
  group.add(globe);
  addBox(group, [x, 1.95, z], [0.1, 0.34, 0.1], mat.metal);
  addBox(group, [x, 1.78, z], [0.48, 0.08, 0.48], mat.metal);
}

function addStudentDesks(group: THREE.Group): void {
  const positions = [
    [4, 7], [7, 7], [10, 7], [13, 7], [16, 7],
    [4, 10], [7, 10], [10, 10], [13, 10], [16, 10],
    [5.5, 13], [12.5, 13], [16, 13],
  ];
  for (const [x, z] of positions) {
    addDeskSet(group, x, z);
  }
}

function addDeskSet(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 1.36, z], [1.22, 0.2, 0.82], mat.wood);
  addBox(group, [x - 0.46, 1.13, z - 0.28], [0.12, 0.46, 0.12], mat.darkWood);
  addBox(group, [x + 0.46, 1.13, z - 0.28], [0.12, 0.46, 0.12], mat.darkWood);
  addBox(group, [x - 0.46, 1.13, z + 0.28], [0.12, 0.46, 0.12], mat.darkWood);
  addBox(group, [x + 0.46, 1.13, z + 0.28], [0.12, 0.46, 0.12], mat.darkWood);
  addBox(group, [x, 1.53, z - 0.05], [0.54, 0.06, 0.42], mat.paper);
  addBox(group, [x + 0.2, 1.6, z + 0.16], [0.38, 0.1, 0.16], mat.green);
  addChair(group, x, z + 0.92);
}

function addChair(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 1.14, z], [0.72, 0.18, 0.64], mat.chairBlue);
  addBox(group, [x, 1.52, z + 0.3], [0.72, 0.66, 0.14], mat.chairBlue);
  addBox(group, [x - 0.25, 0.96, z - 0.2], [0.1, 0.34, 0.1], mat.chairLeg);
  addBox(group, [x + 0.25, 0.96, z - 0.2], [0.1, 0.34, 0.1], mat.chairLeg);
  addBox(group, [x - 0.25, 0.96, z + 0.2], [0.1, 0.34, 0.1], mat.chairLeg);
  addBox(group, [x + 0.25, 0.96, z + 0.2], [0.1, 0.34, 0.1], mat.chairLeg);
}

function addBookshelf(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 1.95, z], [0.3, 1.9, 2.7], mat.darkWood);
  for (const y of [1.35, 1.85, 2.35]) {
    addBox(group, [x, y, z], [0.36, 0.09, 2.55], mat.wood);
  }
  const colors = [mat.red, mat.yellow, mat.green, mat.purple, mat.paper];
  for (let i = 0; i < 14; i++) {
    const shelfZ = z - 1.05 + (i % 7) * 0.35;
    const shelfY = 1.52 + Math.floor(i / 7) * 0.52;
    addBox(group, [x, shelfY, shelfZ], [0.4, 0.36, 0.12], colors[i % colors.length]);
  }
}

function addBulletinBoard(group: THREE.Group, x: number, z: number, text: string): void {
  addBox(group, [x, 2.42, z], [2.2, 1.34, 0.1], new THREE.MeshStandardMaterial({ color: 0xffcc80, roughness: 0.7 }));
  const label = createTextPlane(text, 256, 64, '#5d4037', 'bold 30px sans-serif', 1.35, 0.38);
  label.position.set(x, 2.85, z + 0.07);
  group.add(label);
  addBox(group, [x - 0.55, 2.28, z - 0.08], [0.52, 0.46, 0.04], mat.paper);
  addBox(group, [x + 0.45, 2.18, z - 0.08], [0.48, 0.38, 0.04], mat.green);
}

function addAlphabetBanner(group: THREE.Group): void {
  const banner = createTextPlane('A  B  C  D  E  F  G', 512, 80, '#3949ab', 'bold 34px sans-serif', 4.8, 0.5);
  banner.position.set(10, 4.25, 1.11);
  group.add(banner);
}

function addCeilingLights(group: THREE.Group): void {
  for (const [x, z] of [[5, 6], [15, 6], [5, 12], [15, 12]]) {
    addBox(group, [x, 4.72, z], [2.2, 0.08, 0.38], new THREE.MeshBasicMaterial({ color: 0xfff8d6 }));
    const light = new THREE.PointLight(0xfff5cf, 0.42, 7);
    light.position.set(x, 4.3, z);
    group.add(light);
  }
}

function addDoorAndWindows(group: THREE.Group): void {
  addBox(group, [1.02, 2.1, 3.4], [0.08, 1.45, 1.8], new THREE.MeshStandardMaterial({ color: 0xb3e5fc, roughness: 0.25 }));
  addBox(group, [18.98, 2.1, 3.4], [0.08, 1.45, 1.8], new THREE.MeshStandardMaterial({ color: 0xb3e5fc, roughness: 0.25 }));
}
