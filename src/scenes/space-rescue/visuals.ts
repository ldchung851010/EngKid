import * as THREE from 'three';
import { addBox, createTextPlane } from '../../engine/renderer/ScenePrimitives.js';

const mats = {
  navy: new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.58, metalness: 0.25, flatShading: true }),
  panel: new THREE.MeshStandardMaterial({ color: 0x24457d, roughness: 0.42, metalness: 0.45, flatShading: true }),
  cyan: new THREE.MeshStandardMaterial({ color: 0x57dcff, roughness: 0.3, metalness: 0.25, emissive: 0x0e6f8a, emissiveIntensity: 0.65, flatShading: true }),
  white: new THREE.MeshStandardMaterial({ color: 0xf5f8ff, roughness: 0.42, metalness: 0.18, flatShading: true }),
  red: new THREE.MeshStandardMaterial({ color: 0xef5350, roughness: 0.5, flatShading: true }),
  dark: new THREE.MeshStandardMaterial({ color: 0x26334f, roughness: 0.58, metalness: 0.28, flatShading: true }),
  table: new THREE.MeshStandardMaterial({ color: 0x536b92, roughness: 0.55, metalness: 0.35, flatShading: true }),
};

export function createSpaceRescueDecor(): THREE.Group {
  const group = new THREE.Group();
  addMissionSign(group);
  addRocket(group);
  addControlPanel(group);
  addPlanetDisplay(group);
  addSupplyTable(group);
  addFloorGuides(group);
  addLabLights(group);
  return group;
}

export function animateSpaceRescueDecor(visuals: THREE.Group, delta: number, elapsed: number): void {
  visuals.traverse((object) => {
    const spinSpeed = object.userData.spinSpeed as number | undefined;
    if (spinSpeed) object.rotation.y += delta * spinSpeed;

    const pulseBase = object.userData.pulseBase as number | undefined;
    if (pulseBase !== undefined && object instanceof THREE.PointLight) {
      object.intensity = pulseBase + Math.sin(elapsed * 2.4) * 0.35;
    }
  });
}

function addMissionSign(group: THREE.Group): void {
  const sign = createTextPlane('SPACE RESCUE LAB', 768, 120, '#e7f8ff', 'bold 44px sans-serif', 5.8, 0.9);
  sign.position.set(9, 3.15, 1.03);
  group.add(sign);

  const subtitle = createTextPlane('LISTEN  •  THINK  •  SPEAK', 768, 90, '#66e4ff', 'bold 30px sans-serif', 5.0, 0.58);
  subtitle.position.set(9, 2.48, 1.04);
  group.add(subtitle);
}

function addRocket(group: THREE.Group): void {
  const rocket = new THREE.Group();
  rocket.position.set(3.5, 1.0, 4.0);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.9, 2.6, 12), mats.white);
  body.position.y = 1.45;
  body.castShadow = true;
  rocket.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.1, 12), mats.red);
  nose.position.y = 3.28;
  nose.castShadow = true;
  rocket.add(nose);

  addBox(rocket, [-0.82, 0.78, 0], [0.65, 1.15, 0.18], mats.red);
  addBox(rocket, [0.82, 0.78, 0], [0.65, 1.15, 0.18], mats.red);

  const windowMat = new THREE.MeshStandardMaterial({ color: 0x63dcff, emissive: 0x13718b, emissiveIntensity: 0.85, roughness: 0.25 });
  const window = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 10), windowMat);
  window.scale.z = 0.28;
  window.position.set(0, 1.92, 0.87);
  rocket.add(window);

  group.add(rocket);
}

function addControlPanel(group: THREE.Group): void {
  addBox(group, [14.0, 1.38, 4.3], [2.5, 0.82, 1.0], mats.panel);
  addBox(group, [14.0, 1.94, 4.12], [2.15, 0.18, 0.78], mats.dark);

  for (const [x, color] of [
    [13.45, 0x65e2ff],
    [14.0, 0x72ef9f],
    [14.55, 0xffd166],
  ] as Array<[number, number]>) {
    const lampMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.3 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), lampMat);
    lamp.position.set(x, 2.08, 3.69);
    group.add(lamp);
  }

  const screen = createTextPlane('SYSTEM READY', 384, 100, '#7cf2ff', 'bold 34px monospace', 1.85, 0.5);
  screen.position.set(14.0, 2.18, 3.66);
  screen.rotation.x = -0.12;
  group.add(screen);
}

function addPlanetDisplay(group: THREE.Group): void {
  addPlanet(group, 5.3, 2.25, 1.55, 0x4aa3ff, 0.48, 0.25);
  addPlanet(group, 7.1, 2.25, 1.55, 0xdf5b47, 0.42, 0.45);
  addPlanet(group, 12.8, 2.25, 1.55, 0xd7dde9, 0.42, 0.2);

  const earth = createTextPlane('EARTH', 256, 80, '#e8f4ff', 'bold 28px sans-serif', 1.1, 0.34);
  earth.position.set(5.3, 1.63, 1.06);
  group.add(earth);

  const mars = createTextPlane('MARS', 256, 80, '#ffd1ca', 'bold 28px sans-serif', 1.1, 0.34);
  mars.position.set(7.1, 1.63, 1.06);
  group.add(mars);

  const moon = createTextPlane('MOON', 256, 80, '#f3f6ff', 'bold 28px sans-serif', 1.1, 0.34);
  moon.position.set(12.8, 1.63, 1.06);
  group.add(moon);
}

function addPlanet(group: THREE.Group, x: number, y: number, z: number, color: number, radius: number, spinSpeed: number): void {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.72, flatShading: true });
  const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 2), material);
  sphere.position.set(x, y, z);
  sphere.castShadow = true;
  sphere.userData.spinSpeed = spinSpeed;
  group.add(sphere);
}

function addSupplyTable(group: THREE.Group): void {
  addBox(group, [9, 1.38, 10.2], [6.4, 0.18, 2.2], mats.table);
  for (const x of [6.3, 11.7]) {
    for (const z of [9.45, 10.95]) addBox(group, [x, 1.12, z], [0.16, 0.62, 0.16], mats.dark);
  }

  const label = createTextPlane('MISSION SUPPLIES', 512, 90, '#eaf8ff', 'bold 31px sans-serif', 3.4, 0.52);
  label.position.set(9, 2.08, 9.08);
  label.rotation.x = -Math.PI / 2;
  group.add(label);

  const itemColors = [0x52b9ff, 0xffb653, 0xc48b65, 0xffeb6f, 0x6f83a7, 0x8094ff];
  for (let i = 0; i < itemColors.length; i++) {
    const x = 6.6 + i * 0.95;
    const item = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.42 + (i % 2) * 0.12, 0.52),
      new THREE.MeshStandardMaterial({ color: itemColors[i], roughness: 0.58, flatShading: true }),
    );
    item.position.set(x, 1.72, 10.18);
    item.castShadow = true;
    group.add(item);
  }
}

function addFloorGuides(group: THREE.Group): void {
  const guideMat = new THREE.MeshBasicMaterial({ color: 0x49d7ff, transparent: true, opacity: 0.4 });
  for (const x of [6.8, 9, 11.2]) {
    addBox(group, [x, 1.012, 13.2], [1.35, 0.025, 0.08], guideMat);
  }
  for (const z of [7.1, 8.0]) {
    addBox(group, [9, 1.013, z], [0.08, 0.025, 1.2], guideMat);
  }
}

function addLabLights(group: THREE.Group): void {
  for (const x of [4.5, 9, 13.5]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.24), new THREE.MeshBasicMaterial({ color: 0x9eeeff }));
    strip.position.set(x, 4.65, 7.8);
    group.add(strip);

    const light = new THREE.PointLight(0x82dfff, 1.25, 7.5, 2);
    light.position.set(x, 4.25, 7.8);
    light.userData.pulseBase = 1.25;
    group.add(light);
  }
}
