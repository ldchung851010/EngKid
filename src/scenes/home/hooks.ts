import type { SceneHooks } from '../../engine/runtime/SceneModule.js';

export const homeHooks: SceneHooks = {
  onIntentMatched(intentId, defaultScore) {
    return intentId === 'offer_help' ? defaultScore + 2 : defaultScore;
  },
};
