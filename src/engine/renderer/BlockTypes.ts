/** Block type enumeration for the voxel world */
export enum BlockType {
  AIR = 0,
  FLOOR = 1,
  WALL = 2,
  TABLE = 3,
  CHAIR = 4,
  COUNTER = 5,
}

/** Visual properties for each block type */
export interface BlockVisual {
  color: number;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
}

export const BLOCK_VISUALS: Record<BlockType, BlockVisual> = {
  [BlockType.AIR]: { color: 0x000000, transparent: true }, // never rendered
  [BlockType.FLOOR]: { color: 0xc8b89d, roughness: 0.9 },  // warm wood
  [BlockType.WALL]: { color: 0xe8e0d5, roughness: 0.8 },   // cream plaster
  [BlockType.TABLE]: { color: 0x8b5e3c, roughness: 0.7 },   // dark wood
  [BlockType.CHAIR]: { color: 0xa0522d, roughness: 0.7 },   // sienna
  [BlockType.COUNTER]: { color: 0x696969, roughness: 0.5, metalness: 0.3 }, // gray
};
