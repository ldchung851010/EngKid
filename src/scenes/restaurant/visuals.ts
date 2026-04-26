import * as THREE from 'three';
import { addBox, addLocalBox, createTextSprite, type VectorTuple } from '../../engine/renderer/ScenePrimitives.js';

export function createRestaurantDecor(): THREE.Group {
  const group = new THREE.Group();

  const floorAccent = new THREE.MeshStandardMaterial({ color: 0xfff0c2, roughness: 0.85 });
  const floorAccentAlt = new THREE.MeshStandardMaterial({ color: 0xffd7a8, roughness: 0.85 });
  for (let x = 2; x < 16; x++) {
    for (let z = 6; z < 15; z++) {
      if ((x + z) % 2 === 0) {
        addBox(group, [x + 0.5, 1.015, z + 0.5], [0.92, 0.025, 0.92], (x + z) % 4 === 0 ? floorAccent : floorAccentAlt);
      }
    }
  }

  addCounter(group);
  addCeiling(group);
  addMenuBoard(group);
  addDiningSet(group, 4, 8.5);
  addDiningSet(group, 14, 8.5);
  addDiningSet(group, 4.5, 12);
  addDiningSet(group, 13.5, 12);
  addPlant(group, 2, 2.2);
  addPlant(group, 16, 2.2);
  addWindow(group, [1.03, 2.05, 7], [0.04, 1, 2.3]);
  addWindow(group, [16.97, 2.05, 7], [0.04, 1, 2.3]);
  addWallStripe(group, 9, 1.02);
  addPendantLight(group, 4, 7.2);
  addPendantLight(group, 14, 7.2);
  addPendantLight(group, 9, 5.2);

  return group;
}

function addCounter(group: THREE.Group): void {
  const base = new THREE.MeshStandardMaterial({ color: 0xff8a65, roughness: 0.7 });
  const front = new THREE.MeshStandardMaterial({ color: 0xffcc80, roughness: 0.7 });
  const top = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9be7ff, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.65 });
  addBox(group, [9, 1.32, 5.2], [6.4, 0.82, 1], base);
  addBox(group, [9, 1.54, 5.77], [6.2, 0.28, 0.08], front);
  addBox(group, [9, 1.83, 5.2], [6.7, 0.18, 1.22], top);
  addBox(group, [7.6, 2.15, 4.88], [1.7, 0.52, 0.14], glass);
  addBox(group, [10.4, 2.15, 4.88], [1.7, 0.52, 0.14], glass);
  addFoodDisplay(group, 7.6, 4.7);
  addFoodDisplay(group, 10.4, 4.7);
  addCashRegister(group, 11.7, 5);
}

function addCeiling(group: THREE.Group): void {
  const ceiling = new THREE.MeshBasicMaterial({ color: 0xfff1c4 });
  const beam = new THREE.MeshBasicMaterial({ color: 0xffc66d });
  addBox(group, [9, 3.16, 7.7], [16, 0.12, 13.2], ceiling);
  addBox(group, [9, 2.96, 4.2], [16, 0.12, 0.18], beam);
  addBox(group, [9, 2.96, 11.2], [16, 0.12, 0.18], beam);
  addBox(group, [3.2, 2.96, 7.7], [0.18, 0.12, 13.2], beam);
  addBox(group, [14.8, 2.96, 7.7], [0.18, 0.12, 13.2], beam);
  addBox(group, [9, 2.85, 14.9], [6.4, 0.42, 0.16], new THREE.MeshStandardMaterial({ color: 0xef5350, roughness: 0.62 }));
  const entrance = createTextSprite('WELCOME', 256, 64, '#ffffff', 'bold 34px sans-serif');
  entrance.position.set(9, 2.84, 14.78);
  entrance.scale.set(2.4, 0.6, 1);
  group.add(entrance);
}

function addDiningSet(group: THREE.Group, x: number, z: number): void {
  const tableTop = new THREE.MeshStandardMaterial({ color: 0xffb74d, roughness: 0.55 });
  const tableLeg = new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.65 });
  addBox(group, [x, 1.48, z], [1.45, 0.18, 1.45], tableTop);
  addBox(group, [x - 0.52, 1.22, z - 0.52], [0.14, 0.52, 0.14], tableLeg);
  addBox(group, [x + 0.52, 1.22, z - 0.52], [0.14, 0.52, 0.14], tableLeg);
  addBox(group, [x - 0.52, 1.22, z + 0.52], [0.14, 0.52, 0.14], tableLeg);
  addBox(group, [x + 0.52, 1.22, z + 0.52], [0.14, 0.52, 0.14], tableLeg);
  addChair(group, x, z - 1.05, 0);
  addChair(group, x, z + 1.05, Math.PI);
  addChair(group, x - 1.05, z, -Math.PI / 2);
  addChair(group, x + 1.05, z, Math.PI / 2);
  addPlate(group, x, z);
}

function addChair(group: THREE.Group, x: number, z: number, rotationY: number): void {
  const chairGroup = new THREE.Group();
  chairGroup.position.set(x, 0, z);
  chairGroup.rotation.y = rotationY;
  const seat = new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.65 });
  const leg = new THREE.MeshStandardMaterial({ color: 0x0277bd, roughness: 0.65 });
  addLocalBox(chairGroup, [0, 1.23, 0], [0.62, 0.16, 0.62], seat);
  addLocalBox(chairGroup, [0, 1.55, -0.3], [0.62, 0.58, 0.12], seat);
  addLocalBox(chairGroup, [-0.22, 1.06, -0.2], [0.1, 0.36, 0.1], leg);
  addLocalBox(chairGroup, [0.22, 1.06, -0.2], [0.1, 0.36, 0.1], leg);
  addLocalBox(chairGroup, [-0.22, 1.06, 0.22], [0.1, 0.36, 0.1], leg);
  addLocalBox(chairGroup, [0.22, 1.06, 0.22], [0.1, 0.36, 0.1], leg);
  group.add(chairGroup);
}

function addPlate(group: THREE.Group, x: number, z: number): void {
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.04, 24),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 })
  );
  plate.position.set(x, 1.61, z);
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);
  addBox(group, [x, 1.68, z], [0.38, 0.08, 0.22], new THREE.MeshStandardMaterial({ color: 0xff7043, roughness: 0.5 }));
}

function addFoodDisplay(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x - 0.35, 1.96, z], [0.32, 0.12, 0.24], new THREE.MeshStandardMaterial({ color: 0xffca28, roughness: 0.5 }));
  addBox(group, [x, 1.96, z], [0.32, 0.12, 0.24], new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.5 }));
  addBox(group, [x + 0.35, 1.96, z], [0.32, 0.12, 0.24], new THREE.MeshStandardMaterial({ color: 0xef5350, roughness: 0.5 }));
}

function addCashRegister(group: THREE.Group, x: number, z: number): void {
  const mat = new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.45 });
  addBox(group, [x, 2.02, z], [0.55, 0.18, 0.42], mat);
  addBox(group, [x, 2.24, z - 0.05], [0.42, 0.26, 0.08], new THREE.MeshStandardMaterial({ color: 0x80deea, roughness: 0.35 }));
}

function addMenuBoard(group: THREE.Group): void {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#fff8e1';
  ctx.font = 'bold 46px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("TOM'S CAFE", 256, 56);
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('BURGER', 132, 122);
  ctx.fillText('PIZZA', 256, 122);
  ctx.fillText('SALAD', 380, 122);
  ctx.fillText('JUICE', 168, 178);
  ctx.fillText('WATER', 344, 178);
  ctx.fillStyle = '#ffcc80';
  ctx.fillRect(44, 212, 424, 18);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.75), material);
  board.position.set(9, 2.04, 1.03);
  group.add(board);
}

function addWallStripe(group: THREE.Group, x: number, z: number): void {
  const red = new THREE.MeshStandardMaterial({ color: 0xef5350, roughness: 0.7 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff3e0, roughness: 0.7 });
  for (let i = -4; i <= 4; i++) {
    addBox(group, [x + i * 0.55, 1.18, z], [0.34, 0.12, 0.05], i % 2 === 0 ? red : cream);
  }
}

function addWindow(group: THREE.Group, position: VectorTuple, scale: VectorTuple): void {
  addBox(group, position, scale, new THREE.MeshStandardMaterial({ color: 0x81d4fa, roughness: 0.25, metalness: 0.05 }));
  addBox(group, [position[0], position[1], position[2]], [scale[0] + 0.02, 0.08, scale[2] + 0.28], new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }));
}

function addPlant(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 1.25, z], [0.42, 0.48, 0.42], new THREE.MeshStandardMaterial({ color: 0xff8a65, roughness: 0.7 }));
  addBox(group, [x, 1.62, z], [0.72, 0.45, 0.72], new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.75 }));
  addBox(group, [x - 0.28, 1.82, z + 0.12], [0.4, 0.32, 0.4], new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.75 }));
}

function addPendantLight(group: THREE.Group, x: number, z: number): void {
  addBox(group, [x, 2.96, z], [0.08, 0.5, 0.08], new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.45 }));
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.28, 0.28, 24),
    new THREE.MeshStandardMaterial({ color: 0xfff176, roughness: 0.35 })
  );
  shade.position.set(x, 2.62, z);
  shade.castShadow = true;
  group.add(shade);
  const light = new THREE.PointLight(0xfff3c4, 0.55, 6);
  light.position.set(x, 2.35, z);
  group.add(light);
}
