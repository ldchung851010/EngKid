import * as THREE from 'three';
import { ChunkBuilder, type ChunkData } from './ChunkBuilder.js';

export class VoxelWorld {
  scene: THREE.Scene;
  private chunkGroup: THREE.Group | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Load a map from chunk data, replacing any existing world geometry */
  loadMap(chunk: ChunkData): void {
    // Remove old chunk
    if (this.chunkGroup) {
      this.scene.remove(this.chunkGroup);
      this.disposeGroup(this.chunkGroup);
    }

    this.chunkGroup = ChunkBuilder.build(chunk);
    this.scene.add(this.chunkGroup);
  }

  /** Get current chunk group (for adding NPC meshes, etc.) */
  getChunkGroup(): THREE.Group | null {
    return this.chunkGroup;
  }

  private disposeGroup(group: THREE.Group): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child instanceof THREE.InstancedMesh) {
          child.dispose();
        } else {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      }
    });
  }
}
