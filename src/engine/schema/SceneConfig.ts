// ── Map Types ────────────────────────────────────────────────────
export interface BlockLayer {
  /** Y-coordinate of this layer */
  y: number;
  /** width × depth grid of block type IDs (row-major: grid[z][x]) */
  grid: string[][];
}

export interface MapConfig {
  width: number;
  height: number;
  depth: number;
  layers: BlockLayer[];
}

export interface SceneStartConfig {
  position: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
}

export interface SceneEnvironmentConfig {
  skyColor?: number;
  fogColor?: number;
  fogNear?: number;
  fogFar?: number;
}

export interface CollectibleOverride {
  word: string;
  position?: { x: number; y: number; z: number };
  svg?: string;
}

// ── NPC Types ────────────────────────────────────────────────────
export interface DialogueNode {
  id: string;
  npcText: string;
  hintExamples: string[];
  candidateIntents: Array<{
    intentId: string;
    description: string;
    nextNodeId: string;
  }>;
  fallbackNodeId?: string;
  isTerminal?: boolean;
}

export interface NPCConfig {
  id: string;
  name: string;
  role: string;
  position: { x: number; y: number; z: number };
  appearance: string;
  voice: string;
  speechSpeed: number;
  interaction: {
    type: 'proximity' | 'click';
    radius?: number;
  };
  dialogueTree: DialogueNode[];
}

// ── Task Types ───────────────────────────────────────────────────
export interface TaskConfig {
  id: string;
  description: string;
  trigger: {
    type: 'dialogue_node' | 'zone_enter';
    npcId?: string;
    nodeId?: string;
    zone?: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
  };
  targetIntent: string;
  scoreReward: number;
  maxAttempts?: number;
}

// ── Root Scene Config ───────────────────────────────────────────
export interface SceneConfig {
  schemaVersion: '1.0';
  name: string;
  description: string;
  cefrLevel: 'A1' | 'A2';
  targetVocabulary: string[];
  start?: SceneStartConfig;
  environment?: SceneEnvironmentConfig;
  collectibles?: CollectibleOverride[];
  map: MapConfig;
  npcs: NPCConfig[];
  tasks: TaskConfig[];
}
