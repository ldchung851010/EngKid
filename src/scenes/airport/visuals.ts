import * as THREE from 'three';
import { addBox, createTextSprite } from '../../engine/renderer/ScenePrimitives.js';

export function createAirportDecor(): THREE.Group {
  const group = new THREE.Group();
  const counter = new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.5 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x42a5f5, roughness: 0.65 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffca28, roughness: 0.42 });

  addBox(group, [12, 1.45, 5.2], [13.6, 0.86, 1], counter);
  addBox(group, [12, 2.25, 2.02], [5.2, 1.2, 0.12], blue);
  const sign = createTextSprite('GATE B', 256, 96, '#ffffff', 'bold 44px sans-serif');
  sign.position.set(12, 2.35, 1.92);
  sign.scale.set(2.4, 0.85, 1);
  group.add(sign);

  for (const x of [7.5, 15.5]) {
    for (const z of [9, 11, 13]) {
      addBox(group, [x, 1.16, z], [0.78, 0.24, 0.78], blue);
      addBox(group, [x + 0.9, 1.16, z], [0.78, 0.24, 0.78], blue);
      addBox(group, [x + 0.45, 1.52, z + 0.35], [1.68, 0.72, 0.14], blue);
    }
  }

  addBox(group, [5.5, 1.95, 6.1], [1.4, 1.1, 0.12], yellow);
  addBox(group, [18.5, 1.95, 6.1], [1.4, 1.1, 0.12], yellow);
  const bagMat = new THREE.MeshStandardMaterial({ color: 0xef5350, roughness: 0.7 });
  addBox(group, [6.2, 1.28, 14.8], [0.7, 0.55, 0.4], bagMat);
  addBox(group, [17.8, 1.28, 14.8], [0.7, 0.55, 0.4], bagMat);
  return group;
}
