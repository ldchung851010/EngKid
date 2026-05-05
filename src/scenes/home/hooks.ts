import type { SceneHooks } from '../../engine/runtime/SceneModule.js';
import { createBonusIntentsHook } from '../../engine/runtime/bonus-intent-helper.js';

export const homeHooks: SceneHooks = {
  ...createBonusIntentsHook({ offer_help: 2 }),
};
