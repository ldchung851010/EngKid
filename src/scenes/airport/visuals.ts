import * as THREE from 'three';
import { addBox, addLocalBox, createTextSprite } from '../../engine/renderer/ScenePrimitives.js';

const mat = {
  counter: new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.5, flatShading: true }),
  counterDark: new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.56, flatShading: true }),
  blue: new THREE.MeshStandardMaterial({ color: 0x1976d2, roughness: 0.6, flatShading: true }),
  skyBlue: new THREE.MeshStandardMaterial({ color: 0x81d4fa, roughness: 0.26, transparent: true, opacity: 0.78, flatShading: true }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xffca28, roughness: 0.45, flatShading: true }),
  white: new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.62, flatShading: true }),
  black: new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.52, flatShading: true }),
  red: new THREE.MeshStandardMaterial({ color: 0xef5350, roughness: 0.72, flatShading: true }),
  green: new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.72, flatShading: true }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.38, metalness: 0.08, flatShading: true }),
};

export function createAirportDecor(): THREE.Group {
  const group = new THREE.Group();

  addFloorGuides(group);
  addGlassFacade(group);
  addCheckInCounters(group);
  addFlightBoards(group);
  addGateArea(group);
  addSeating(group);
  addSecurityQueue(group);
  addLuggage(group);
  addPlaneModel(group);

  return group;
}

function addFloorGuides(group: THREE.Group): void {
  addBox(group, [12, 1.025, 8.2], [20, 0.03, 0.16], mat.yellow);
  addBox(group, [12, 1.03, 12.2], [14, 0.03, 0.12], mat.blue);
  for (let x = 3; x <= 21; x += 3) {
    addBox(group, [x, 1.035, 15], [1.2, 0.025, 0.18], mat.white);
  }
}

function addGlassFacade(group: THREE.Group): void {
  for (let x = 3; x <= 21; x += 3) {
    addBox(group, [x, 2.35, 1.02], [2.2, 1.75, 0.08], mat.skyBlue);
    addBox(group, [x, 2.35, 0.96], [0.08, 1.92, 0.12], mat.metal);
  }
  addBox(group, [12, 3.4, 1], [20, 0.14, 0.14], mat.metal);
  addBox(group, [12, 1.42, 1], [20, 0.12, 0.14], mat.metal);
}

function addCheckInCounters(group: THREE.Group): void {
  addBox(group, [12, 1.4, 5.15], [13.8, 0.82, 1.05], mat.counter);
  addBox(group, [12, 1.92, 5.15], [14.1, 0.18, 1.24], mat.counterDark);
  for (const x of [6.5, 9.2, 12, 14.8, 17.5]) {
    addBox(group, [x, 2.32, 4.54], [1.65, 0.78, 0.12], mat.blue);
    const label = createTextSprite('CHECK-IN', 256, 64, '#ffffff', 'bold 26px sans-serif');
    label.position.set(x, 2.34, 4.44);
    label.scale.set(1.25, 0.34, 1);
    group.add(label);
    addBox(group, [x - 0.42, 2.04, 5.76], [0.54, 0.08, 0.36], mat.white);
    addBox(group, [x + 0.36, 2.06, 5.68], [0.42, 0.2, 0.1], mat.black);
  }
}

function addFlightBoards(group: THREE.Group): void {
  addBox(group, [12, 3.15, 2.12], [6.5, 1.35, 0.12], mat.black);
  const title = createTextSprite('DEPARTURES', 512, 96, '#ffeb3b', 'bold 44px sans-serif');
  title.position.set(12, 3.42, 2.02);
  title.scale.set(3.9, 0.62, 1);
  group.add(title);
  const rows = createTextSprite('B12  LONDON   ON TIME', 512, 96, '#b2ff59', 'bold 30px monospace');
  rows.position.set(12, 2.9, 2.0);
  rows.scale.set(4.2, 0.5, 1);
  group.add(rows);
}

function addGateArea(group: THREE.Group): void {
  addBox(group, [20.6, 2.26, 9.5], [0.16, 1.7, 3.2], mat.blue);
  const gate = createTextSprite('GATE B', 256, 96, '#ffffff', 'bold 42px sans-serif');
  gate.position.set(20.5, 2.55, 9.5);
  gate.scale.set(0.62, 1.8, 1);
  gate.rotation.z = -Math.PI / 2;
  group.add(gate);
  addBox(group, [20.35, 1.72, 11.9], [0.28, 1.1, 1.2], mat.skyBlue);
}

function addSeating(group: THREE.Group): void {
  for (const z of [9.2, 11.5, 13.8]) {
    addSeatRow(group, 7.3, z);
    addSeatRow(group, 15.2, z);
  }
}

function addSeatRow(group: THREE.Group, x: number, z: number): void {
  for (let i = 0; i < 3; i++) {
    const sx = x + i * 0.92;
    addBox(group, [sx, 1.15, z], [0.76, 0.22, 0.76], mat.blue);
    addBox(group, [sx, 1.58, z + 0.32], [0.76, 0.72, 0.14], mat.blue);
  }
  addBox(group, [x + 0.92, 1.02, z], [3.1, 0.12, 0.12], mat.metal);
  addBox(group, [x - 0.45, 0.98, z], [0.12, 0.38, 0.12], mat.metal);
  addBox(group, [x + 2.28, 0.98, z], [0.12, 0.38, 0.12], mat.metal);
}

function addSecurityQueue(group: THREE.Group): void {
  for (const x of [4.4, 5.5, 6.6]) {
    addBox(group, [x, 1.42, 7.2], [0.12, 0.82, 0.12], mat.metal);
    addBox(group, [x, 1.78, 8.2], [0.12, 0.82, 0.12], mat.metal);
    addBox(group, [x + 0.55, 1.78, 7.7], [1.1, 0.08, 0.08], mat.blue);
  }
  addBox(group, [4.8, 1.36, 6.4], [1.5, 0.42, 0.9], mat.black);
  addBox(group, [4.8, 1.72, 6.4], [1.2, 0.12, 0.72], mat.metal);
}

function addLuggage(group: THREE.Group): void {
  addSuitcase(group, 6.2, 14.8, mat.red);
  addSuitcase(group, 17.8, 14.8, mat.green);
  addSuitcase(group, 10.5, 6.6, mat.yellow);
  addSuitcase(group, 14.2, 6.7, mat.blue);
}

function addSuitcase(group: THREE.Group, x: number, z: number, material: THREE.Material): void {
  addBox(group, [x, 1.35, z], [0.78, 0.72, 0.42], material);
  addBox(group, [x, 1.76, z], [0.34, 0.08, 0.12], mat.metal);
  addBox(group, [x - 0.22, 0.96, z + 0.2], [0.12, 0.12, 0.12], mat.black);
  addBox(group, [x + 0.22, 0.96, z + 0.2], [0.12, 0.12, 0.12], mat.black);
}

function addPlaneModel(group: THREE.Group): void {
  const plane = new THREE.Group();
  plane.position.set(3.6, 3.35, 2.4);
  plane.rotation.y = -0.45;
  addLocalBox(plane, [0, 0, 0], [2.2, 0.28, 0.34], mat.white);
  addLocalBox(plane, [0.65, 0, 0], [0.75, 0.08, 1.45], mat.white);
  addLocalBox(plane, [-1.0, 0.18, 0], [0.5, 0.1, 0.8], mat.blue);
  addLocalBox(plane, [1.25, 0, 0], [0.28, 0.22, 0.22], mat.blue);
  group.add(plane);
}

function addCeilingLights(group: THREE.Group): void {
  for (const x of [5, 12, 19]) {
    addBox(group, [x, 4.78, 8.5], [3.8, 0.08, 0.32], new THREE.MeshBasicMaterial({ color: 0xe3f2fd }));
    const light = new THREE.PointLight(0xe3f2fd, 0.45, 8);
    light.position.set(x, 4.3, 8.5);
    group.add(light);
  }
}
