import * as THREE from 'three';
import { addBox, createTextSprite } from '../../engine/renderer/ScenePrimitives.js';

export function createHotelDecor(): THREE.Group {
  const group = new THREE.Group();
  const marble = new THREE.MeshStandardMaterial({ color: 0xfff8e1, roughness: 0.45 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffca28, roughness: 0.35 });
  const sofa = new THREE.MeshStandardMaterial({ color: 0x5c6bc0, roughness: 0.72 });

  addBox(group, [10, 1.45, 4.4], [10.8, 0.9, 1.1], marble);
  addBox(group, [10, 1.98, 4.4], [11.2, 0.18, 1.25], gold);
  addBox(group, [10, 3.1, 1.05], [4.8, 1.3, 0.12], gold);
  const sign = createTextSprite('HOTEL', 256, 96, '#ffffff', 'bold 48px sans-serif');
  sign.position.set(10, 3.18, 0.94);
  sign.scale.set(2.4, 0.85, 1);
  group.add(sign);

  for (const x of [4.8, 15.2]) {
    addBox(group, [x, 1.22, 11], [2.2, 0.36, 0.88], sofa);
    addBox(group, [x, 1.62, 11.38], [2.2, 0.75, 0.18], sofa);
    addBox(group, [x, 1.45, 9.7], [1, 0.16, 1], new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.7 }));
  }

  addBox(group, [2.2, 1.55, 2.2], [0.5, 1.1, 0.5], gold);
  addBox(group, [17.8, 1.55, 2.2], [0.5, 1.1, 0.5], gold);
  return group;
}
