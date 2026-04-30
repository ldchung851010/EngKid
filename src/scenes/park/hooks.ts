import type { SceneHooks } from '../../engine/runtime/SceneModule.js';

export const parkHooks: SceneHooks = {
  onIntentMatched(intentId, defaultScore) {
    return intentId === 'describe_park_item' ? defaultScore + 2 : defaultScore;
  },
};
