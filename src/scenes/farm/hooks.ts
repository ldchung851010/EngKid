import type { SceneHooks } from '../../engine/runtime/SceneModule.js';

export const farmHooks: SceneHooks = {
  onIntentMatched(intentId, defaultScore) {
    return intentId === 'offer_farm_help' ? defaultScore + 2 : defaultScore;
  },
};
