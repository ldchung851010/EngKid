import * as THREE from 'three';
import { BlockType, BLOCK_VISUALS } from './BlockTypes.js';

export interface ChunkData {
  originX: number;
  originY: number;
  originZ: number;
  width: number;
  height: number;
  depth: number;
  data: Uint8Array; // flat array, index = x + z*width + y*width*depth
}

export class ChunkBuilder {
  /** Build InstancedMesh groups from chunk data. Returns a THREE.Group. */
  static build(chunk: ChunkData): THREE.Group {
    const { originX, originY, originZ, width, height, depth, data } = chunk;
    const group = new THREE.Group();

    // Collect visible face positions per block type
    const facesByType = new Map<BlockType, THREE.Matrix4[]>();

    const idx = (x: number, y: number, z: number) => x + z * width + y * width * depth;
    const isAir = (x: number, y: number, z: number): boolean => {
      if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= depth) return true;
      return data[idx(x, y, z)] === BlockType.AIR;
    };

    // Six face directions: right, left, up, down, front, back
    const dirs = [
      { dx: 1, dy: 0, dz: 0 },
      { dx: -1, dy: 0, dz: 0 },
      { dx: 0, dy: 1, dz: 0 },
      { dx: 0, dy: -1, dz: 0 },
      { dx: 0, dy: 0, dz: 1 },
      { dx: 0, dy: 0, dz: -1 },
    ];

    for (let y = 0; y < height; y++) {
      for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
          const blockType = data[idx(x, y, z)] as BlockType;
          if (blockType === BlockType.AIR) continue;

          // Check if at least one face is visible
          const visible = dirs.some((d) => isAir(x + d.dx, y + d.dy, z + d.dz));
          if (!visible) continue;

          const mat = new THREE.Matrix4();
          mat.setPosition(originX + x + 0.5, originY + y + 0.5, originZ + z + 0.5);

          const list = facesByType.get(blockType) ?? [];
          list.push(mat);
          facesByType.set(blockType, list);
        }
      }
    }

    // Create one InstancedMesh per block type
    const sharedGeo = new THREE.BoxGeometry(1, 1, 1);

    for (const [blockType, matrices] of facesByType) {
      const visual = BLOCK_VISUALS[blockType];
      if (visual.transparent) continue;

      const material = new THREE.MeshStandardMaterial({
        color: visual.color,
        roughness: visual.roughness ?? 0.5,
        metalness: visual.metalness ?? 0,
        flatShading: true,
      });

      const mesh = new THREE.InstancedMesh(sharedGeo, material, matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.needsUpdate = true;

      group.add(mesh);
    }

    return group;
  }
}
