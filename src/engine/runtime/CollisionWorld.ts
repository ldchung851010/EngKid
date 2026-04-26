import * as THREE from 'three';
import { BlockType } from '../renderer/BlockTypes.js';
import type { ChunkData } from '../renderer/ChunkBuilder.js';

export interface CollisionOptions {
  radius?: number;
  minY?: number;
  maxY?: number;
}

interface CollisionBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/**
 * Lightweight scene collision layer for first-person navigation.
 *
 * It treats non-air map blocks above the floor as solid, and can also ingest
 * decorative mesh bounds as simple AABB colliders. This keeps collision in the
 * engine while allowing scene authors to keep authoring declarative scenes.
 */
export class CollisionWorld {
  private boxes: CollisionBox[] = [];

  clear(): void {
    this.boxes = [];
  }

  loadChunk(chunk: ChunkData): void {
    const { originX, originY, originZ, width, height, depth, data } = chunk;
    const idx = (x: number, y: number, z: number) => x + z * width + y * width * depth;

    for (let y = 1; y < height; y++) {
      for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
          const blockType = data[idx(x, y, z)] as BlockType;
          if (blockType === BlockType.AIR) continue;
          this.boxes.push({
            minX: originX + x,
            maxX: originX + x + 1,
            minY: originY + y,
            maxY: originY + y + 1,
            minZ: originZ + z,
            maxZ: originZ + z + 1,
          });
        }
      }
    }
  }

  addObjectColliders(object: THREE.Object3D): void {
    object.updateMatrixWorld(true);
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (child.userData.collidable === false) return;

      const box = new THREE.Box3().setFromObject(child);
      if (box.isEmpty()) return;

      const size = new THREE.Vector3();
      box.getSize(size);

      // Ignore floor decals, tiny props, and overhead-only objects.
      if (size.y < 0.2 || size.x < 0.12 || size.z < 0.12) return;
      if (box.max.y < 1.18 || box.min.y > 3.4) return;

      this.boxes.push({
        minX: box.min.x,
        maxX: box.max.x,
        minY: box.min.y,
        maxY: box.max.y,
        minZ: box.min.z,
        maxZ: box.max.z,
      });
    });
  }

  canOccupy(position: THREE.Vector3, options: CollisionOptions = {}): boolean {
    const radius = options.radius ?? 0.35;
    const minY = options.minY ?? 1.05;
    const maxY = options.maxY ?? 2.85;

    for (const box of this.boxes) {
      if (maxY < box.minY || minY > box.maxY) continue;
      if (position.x + radius <= box.minX || position.x - radius >= box.maxX) continue;
      if (position.z + radius <= box.minZ || position.z - radius >= box.maxZ) continue;
      return false;
    }

    return true;
  }
}
