import type { SceneHooks } from '../../engine/runtime/SceneModule.js';

export const zooHooks: SceneHooks = {
  onIntentMatched(intentId, defaultScore) {
    return intentId === 'describe_animal' ? defaultScore + 2 : defaultScore;
  },
};
