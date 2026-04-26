import * as THREE from 'three';
import { addBox, createTextSprite } from '../../engine/renderer/ScenePrimitives.js';

export function createSchoolDecor(): THREE.Group {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.7 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x64b5f6, roughness: 0.7 });
  const board = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.55 });

  addBox(group, [10, 2.25, 1.04], [5.8, 1.6, 0.12], board);
  const title = createTextSprite('ABC', 256, 96, '#ffffff', 'bold 50px sans-serif');
  title.position.set(10, 2.45, 0.96);
  title.scale.set(2, 0.75, 1);
  group.add(title);

  for (const x of [4, 7, 10, 13, 16]) {
    for (const z of [6, 9, 12]) {
      addBox(group, [x, 1.34, z], [1.15, 0.2, 0.75], wood);
      addBox(group, [x, 1.15, z + 0.85], [0.72, 0.22, 0.72], blue);
      addBox(group, [x, 1.55, z + 1.15], [0.72, 0.7, 0.14], blue);
    }
  }

  addBox(group, [3, 2.1, 1.05], [1.2, 0.9, 0.1], new THREE.MeshStandardMaterial({ color: 0xfff59d, roughness: 0.55 }));
  addBox(group, [17, 2.1, 1.05], [1.2, 0.9, 0.1], new THREE.MeshStandardMaterial({ color: 0xfff59d, roughness: 0.55 }));
  return group;
}
