import type { SceneHooks } from '../../engine/runtime/SceneModule.js';
import { createBonusIntentsHook } from '../../engine/runtime/bonus-intent-helper.js';

export const parkHooks: SceneHooks = {
  ...createBonusIntentsHook({ describe_park_item: 2 }),
};
