import type { SceneConfig } from '../schema/SceneConfig.js';
import { validateConfig } from '../schema/ConfigValidator.js';
import { BlockType, BLOCK_TYPE_BY_ID } from '../renderer/BlockTypes.js';
import type { ChunkData } from '../renderer/ChunkBuilder.js';

/**
 * Scene Loader — validates config, converts to voxel data, places NPC markers.
 */
export class SceneLoader {
  /**
   * Validate a scene config. Returns errors array or empty if valid.
   */
  static validate(config: SceneConfig): string[] {
    const result = validateConfig(config);
    if (result.valid) return [];
    return result.errors.map((e) => `${e.path}: ${e.message}`);
  }

  /**
   * Convert a SceneConfig map to ChunkData for the voxel renderer.
   */
  static buildChunkData(config: SceneConfig): ChunkData {
    const { width, height, depth, layers } = config.map;
    const size = width * height * depth;
    const data = new Uint8Array(size);

    const idx = (x: number, y: number, z: number) => x + z * width + y * width * depth;
    // Fill AIR by default
    data.fill(BlockType.AIR);

    // Apply layers
    for (const layer of layers) {
      for (let z = 0; z < Math.min(depth, layer.grid.length); z++) {
        const row = layer.grid[z];
        if (!row) continue;
        for (let x = 0; x < Math.min(width, row.length); x++) {
          const blockType = BLOCK_TYPE_BY_ID[row[x]] ?? BlockType.AIR;
          const y = layer.y;
          if (y >= 0 && y < height) {
            data[idx(x, y, z)] = blockType;
          }
        }
      }
    }

    return {
      originX: 0,
      originY: 0,
      originZ: 0,
      width,
      height,
      depth,
      data,
    };
  }
}
