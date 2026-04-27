/** Block type enumeration for the voxel world */
export enum BlockType {
  AIR = 0,
  FLOOR = 1,
  WALL = 2,
  TABLE = 3,
  CHAIR = 4,
  COUNTER = 5,
  GRASS = 6,
  WATER = 7,
  GLASS = 8,
  DESK = 9,
  BED = 10,
  SIGN = 11,
  ROAD = 12,
  CARPET = 13,
  PORTAL = 14,
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
  [BlockType.GRASS]: { color: 0x66bb6a, roughness: 0.9 },
  [BlockType.WATER]: { color: 0x4fc3f7, roughness: 0.25, metalness: 0.05 },
  [BlockType.GLASS]: { color: 0xb3e5fc, roughness: 0.18, metalness: 0.05 },
  [BlockType.DESK]: { color: 0x8d6e63, roughness: 0.72 },
  [BlockType.BED]: { color: 0x90caf9, roughness: 0.72 },
  [BlockType.SIGN]: { color: 0xfff176, roughness: 0.55 },
  [BlockType.ROAD]: { color: 0x78909c, roughness: 0.82 },
  [BlockType.CARPET]: { color: 0xef9a9a, roughness: 0.95 },
  [BlockType.PORTAL]: { color: 0x7c4dff, roughness: 0.1, metalness: 0.8 },
};

export const BLOCK_TYPE_BY_ID: Record<string, BlockType> = Object.freeze({
  AIR: BlockType.AIR,
  FLOOR: BlockType.FLOOR,
  WALL: BlockType.WALL,
  TABLE: BlockType.TABLE,
  CHAIR: BlockType.CHAIR,
  COUNTER: BlockType.COUNTER,
  GRASS: BlockType.GRASS,
  WATER: BlockType.WATER,
  GLASS: BlockType.GLASS,
  DESK: BlockType.DESK,
  BED: BlockType.BED,
  SIGN: BlockType.SIGN,
  ROAD: BlockType.ROAD,
  CARPET: BlockType.CARPET,
  PORTAL: BlockType.PORTAL,
});
