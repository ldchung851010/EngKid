import * as THREE from 'three';

export type VectorTuple = [number, number, number];

function drawTextToCanvas(
  text: string,
  width: number,
  height: number,
  color: string,
  font: string,
): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 5;
  ctx.fillText(text, width / 2, height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  return { canvas, texture };
}

/** Billboard text sprite — always faces the camera (for NPC names, labels) */
export function createTextSprite(
  text: string,
  width: number,
  height: number,
  color: string,
  font: string
): THREE.Sprite {
  const { texture } = drawTextToCanvas(text, width, height, color, font);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.01, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.raycast = () => {};
  return sprite;
}

/** Fixed-orientation text plane — sits flat on surfaces (for blackboards, signs, walls) */
export function createTextPlane(
  text: string,
  width: number,
  height: number,
  color: string,
  font: string,
  planeW: number,
  planeH: number,
): THREE.Mesh {
  const { texture } = drawTextToCanvas(text, width, height, color, font);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.01, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), material);
  mesh.raycast = () => {};
  return mesh;
}

export function addBox(
  parent: THREE.Object3D,
  position: VectorTuple,
  scale: VectorTuple,
  material: THREE.Material
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(scale[0], scale[1], scale[2]), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function disposeObject3D(object: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      geometries.add(child.geometry);
      collectMaterials(child.material, materials);
    } else if (child instanceof THREE.Sprite) {
      collectMaterials(child.material, materials);
    }
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => {
    const texture = (material as THREE.Material & { map?: THREE.Texture | null }).map;
    texture?.dispose();
    material.dispose();
  });
}

function collectMaterials(material: THREE.Material | THREE.Material[], target: Set<THREE.Material>): void {
  if (Array.isArray(material)) {
    material.forEach((item) => target.add(item));
  } else {
    target.add(material);
  }
}
