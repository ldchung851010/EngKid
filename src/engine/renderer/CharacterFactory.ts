import * as THREE from 'three';
import type { NPCConfig } from '../schema/SceneConfig.js';
import { addLocalBox } from './ScenePrimitives.js';

export function createVoxelCharacter(npc: NPCConfig): THREE.Group {
  switch (npc.appearance) {
    case 'waiter_male_01':
      return createWaiterModel(npc);
    default:
      return createDefaultCharacter(npc);
  }
}

function createWaiterModel(npc: NPCConfig): THREE.Group {
  const group = new THREE.Group();
  positionCharacter(group, npc);

  const skin = new THREE.MeshStandardMaterial({ color: 0xffc7a3, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x3d2a1f, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
  const apron = new THREE.MeshStandardMaterial({ color: 0xff6f61, roughness: 0.55 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.7 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
  const smile = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.55 });
  const tray = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.35, metalness: 0.2 });

  addLocalBox(group, [0, 0.34, 0], [0.22, 0.68, 0.22], pants);
  addLocalBox(group, [-0.16, 0.34, 0], [0.2, 0.68, 0.22], pants);
  addLocalBox(group, [0.08, 0.03, 0.08], [0.28, 0.12, 0.34], shoes);
  addLocalBox(group, [-0.2, 0.03, 0.08], [0.28, 0.12, 0.34], shoes);
  addLocalBox(group, [-0.04, 0.95, 0], [0.66, 0.78, 0.34], shirt);
  addLocalBox(group, [-0.04, 0.96, 0.18], [0.45, 0.62, 0.05], apron);
  addLocalBox(group, [-0.04, 1.22, 0.22], [0.12, 0.08, 0.04], black);
  addLocalBox(group, [-0.48, 0.98, 0], [0.18, 0.68, 0.18], skin);
  addLocalBox(group, [0.4, 0.98, 0], [0.18, 0.68, 0.18], skin);
  addLocalBox(group, [0.54, 0.88, 0.22], [0.5, 0.06, 0.32], tray);
  addLocalBox(group, [0.54, 0.95, 0.22], [0.18, 0.08, 0.18], new THREE.MeshStandardMaterial({ color: 0xfff176, roughness: 0.5 }));
  addLocalBox(group, [0, 1.55, 0], [0.52, 0.52, 0.52], skin);
  addLocalBox(group, [0, 1.84, 0], [0.58, 0.18, 0.58], hair);
  addLocalBox(group, [-0.11, 1.6, 0.27], [0.055, 0.055, 0.025], black);
  addLocalBox(group, [0.11, 1.6, 0.27], [0.055, 0.055, 0.025], black);
  addLocalBox(group, [0, 1.47, 0.28], [0.18, 0.035, 0.025], smile);

  return group;
}

function createDefaultCharacter(npc: NPCConfig): THREE.Group {
  const group = new THREE.Group();
  positionCharacter(group, npc);

  const skin = new THREE.MeshStandardMaterial({ color: 0xffc7a3, roughness: 0.7 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x64b5f6, roughness: 0.6 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.7 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.75 });
  const face = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });

  addLocalBox(group, [-0.14, 0.34, 0], [0.2, 0.68, 0.22], pants);
  addLocalBox(group, [0.14, 0.34, 0], [0.2, 0.68, 0.22], pants);
  addLocalBox(group, [-0.14, 0.03, 0.08], [0.28, 0.12, 0.34], shoes);
  addLocalBox(group, [0.14, 0.03, 0.08], [0.28, 0.12, 0.34], shoes);
  addLocalBox(group, [0, 0.95, 0], [0.64, 0.76, 0.34], shirt);
  addLocalBox(group, [-0.47, 0.98, 0], [0.18, 0.64, 0.18], skin);
  addLocalBox(group, [0.47, 0.98, 0], [0.18, 0.64, 0.18], skin);
  addLocalBox(group, [0, 1.55, 0], [0.52, 0.52, 0.52], skin);
  addLocalBox(group, [0, 1.84, 0], [0.58, 0.18, 0.58], hair);
  addLocalBox(group, [-0.11, 1.6, 0.27], [0.055, 0.055, 0.025], face);
  addLocalBox(group, [0.11, 1.6, 0.27], [0.055, 0.055, 0.025], face);
  addLocalBox(group, [0, 1.47, 0.28], [0.18, 0.035, 0.025], face);

  return group;
}

function positionCharacter(group: THREE.Group, npc: NPCConfig): void {
  group.position.set(npc.position.x + 0.5, npc.position.y + 1, npc.position.z + 0.5);
}
