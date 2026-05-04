import * as THREE from 'three';

export type VectorTuple = [number, number, number];

export function createTextSprite(
  text: string,
  width: number,
  height: number,
  color: string,
  font: string
): THREE.Sprite {
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
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.raycast = () => {};
  return sprite;
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

export function addLocalBox(
  parent: THREE.Object3D,
  position: VectorTuple,
  scale: VectorTuple,
  material: THREE.Material
): THREE.Mesh {
  return addBox(parent, position, scale, material);
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
