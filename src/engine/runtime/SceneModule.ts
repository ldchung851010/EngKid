import type * as THREE from 'three';
import type { SessionContext } from './SessionMachine.js';
import type { SceneConfig } from '../schema/SceneConfig.js';

export interface SceneHooks {
  onBeforeDialogue?: (npcId: string, nodeId: string, ctx: SessionContext) => boolean;
  onIntentMatched?: (intentId: string, defaultScore: number, ctx: SessionContext) => number;
  onTaskComplete?: (taskId: string, ctx: SessionContext) => void;
}

export interface SceneModule {
  id: string;
  config: SceneConfig;
  hooks?: SceneHooks;
  createVisuals?: () => THREE.Group;
}

export const emptySceneHooks: Required<SceneHooks> = {
  onBeforeDialogue: () => true,
  onIntentMatched: (_intentId, defaultScore) => defaultScore,
  onTaskComplete: () => undefined,
};
