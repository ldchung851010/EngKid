import type { SceneHooks } from '../../engine/runtime/SceneModule.js';
import { createBonusIntentsHook } from '../../engine/runtime/bonus-intent-helper.js';

export const farmHooks: SceneHooks = {
  ...createBonusIntentsHook({ offer_farm_help: 2 }),
};
