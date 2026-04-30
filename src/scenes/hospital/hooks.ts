import type { SceneHooks } from '../../engine/runtime/SceneModule.js';

export const hospitalHooks: SceneHooks = {
  onIntentMatched(intentId, defaultScore) {
    return intentId === 'ask_help' ? defaultScore + 2 : defaultScore;
  },
};
