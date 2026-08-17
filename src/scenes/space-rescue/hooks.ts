import type { SceneHooks } from '../../engine/runtime/SceneModule.js';
import { LearnerStore } from '../../mvp/LearnerStore.js';
import type { ConceptId } from '../../mvp/types.js';

const learner = new LearnerStore();

const conceptsByIntent: Record<string, ConceptId[]> = {
  identify_mars: ['space_vocab'],
  ask_battery_location: ['wh_question', 'space_vocab'],
  infer_control_panel: ['prepositions', 'space_vocab'],
  reason_supply_1: ['should', 'because', 'need'],
  reason_supply_2: ['should', 'because', 'need'],
  reason_supply_3: ['should', 'because', 'need'],
  transfer_reasoning: ['should', 'because', 'need', 'space_vocab'],
};

export const spaceRescueHooks: SceneHooks = {
  onIntentMatched(intentId, defaultScore) {
    const concepts = conceptsByIntent[intentId] ?? [];
    if (concepts.length > 0) {
      learner.recordSuccess(concepts, 0, intentId === 'transfer_reasoning');
    }

    // Give a small bonus for the two core generative parts of the mission.
    if (intentId.startsWith('reason_supply_')) return defaultScore + 2;
    if (intentId === 'transfer_reasoning') return defaultScore + 5;
    return defaultScore;
  },
};
