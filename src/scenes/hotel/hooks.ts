import type { SceneHooks } from '../../engine/runtime/SceneModule.js';

export const hotelHooks: SceneHooks = {
  onIntentMatched(intentId, defaultScore) {
    return intentId === 'check_in' ? defaultScore + 1 : defaultScore;
  },
};
