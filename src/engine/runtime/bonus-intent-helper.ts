import type { SceneHooks } from './SceneModule.js';

/** Create a declarative onIntentMatched hook from a bonus map */
export function createBonusIntentsHook(
  bonuses: Record<string, number>,
): Pick<Required<SceneHooks>, 'onIntentMatched'> {
  return {
    onIntentMatched(intentId, defaultScore) {
      const bonus = bonuses[intentId] ?? 0;
      return bonus ? defaultScore + bonus : defaultScore;
    },
  };
}
