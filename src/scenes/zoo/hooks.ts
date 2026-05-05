import type { SceneHooks } from '../../engine/runtime/SceneModule.js';
import { createBonusIntentsHook } from '../../engine/runtime/bonus-intent-helper.js';

export const zooHooks: SceneHooks = {
  ...createBonusIntentsHook({ describe_animal: 2 }),
};
