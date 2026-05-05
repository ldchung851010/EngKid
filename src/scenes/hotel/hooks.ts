import type { SceneHooks } from '../../engine/runtime/SceneModule.js';
import { createBonusIntentsHook } from '../../engine/runtime/bonus-intent-helper.js';

export const hotelHooks: SceneHooks = {
  ...createBonusIntentsHook({ check_in: 1 }),
};
