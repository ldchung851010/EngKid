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
  [BlockType.FLOOR]: { color: 0xffe0b2, roughness: 0.85 },  // warm cartoon tile
  [BlockType.WALL]: { color: 0xfff8e1, roughness: 0.82 },   // sunny cafe plaster
  [BlockType.TABLE]: { color: 0xffb74d, roughness: 0.65 },
  [BlockType.CHAIR]: { color: 0x4fc3f7, roughness: 0.65 },
  [BlockType.COUNTER]: { color: 0xff8a65, roughness: 0.55 },
};
