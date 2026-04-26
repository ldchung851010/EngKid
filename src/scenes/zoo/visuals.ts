import * as THREE from 'three';
import { addBox, createTextSprite } from '../../engine/renderer/ScenePrimitives.js';

export function createZooDecor(): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.9 });
  const signMat = new THREE.MeshStandardMaterial({ color: 0xfff176, roughness: 0.55 });

  for (const [x, z] of [[3, 12], [18, 4], [18, 13], [4, 3]]) {
    addBox(group, [x, 1.45, z], [0.36, 0.9, 0.36], trunk);
    addBox(group, [x, 2.12, z], [1.35, 0.85, 1.35], leaf);
  }

  addBox(group, [11, 1.55, 15.2], [3.4, 1.1, 0.18], signMat);
  const sign = createTextSprite('ZOO', 256, 96, '#2e7d32', 'bold 54px sans-serif');
  sign.position.set(11, 1.85, 15.08);
  sign.scale.set(2.1, 0.78, 1);
  group.add(sign);

  for (const [x, z, color] of [[4, 6, 0xffca28], [17, 7, 0xff7043], [17, 12, 0x9575cd]]) {
    addBox(group, [x, 1.18, z], [0.9, 0.36, 0.9], new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
    addBox(group, [x, 1.62, z], [0.55, 0.38, 0.55], new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  }

  return group;
}
