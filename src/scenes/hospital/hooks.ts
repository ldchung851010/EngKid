import type { SceneHooks } from '../../engine/runtime/SceneModule.js';
import { createBonusIntentsHook } from '../../engine/runtime/bonus-intent-helper.js';

export const hospitalHooks: SceneHooks = {
  ...createBonusIntentsHook({ ask_help: 2 }),
};
