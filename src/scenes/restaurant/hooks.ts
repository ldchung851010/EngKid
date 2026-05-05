import type { SceneHooks } from '../../engine/runtime/SceneModule.js';
import { createBonusIntentsHook } from '../../engine/runtime/bonus-intent-helper.js';

/**
 * Restaurant scene hooks.
 * V1: 2-3 explicit function callbacks for scene-specific logic.
 *
 * The `sceneFlags` field in SessionContext stores mutable scene state
 * accessible to hooks (e.g., { hasListenedToCustomers: false }).
 */
export const restaurantHooks: SceneHooks = {
  ...createBonusIntentsHook({ order_more: 5 }),

  /**
   * Called before dialogue starts with an NPC.
   * Return false to block/prevent the dialogue from starting.
   */
  onBeforeDialogue(npcId, nodeId, ctx) {
    const flags = ctx.sceneFlags as Record<string, unknown>;
    if (npcId === 'waiter' && nodeId === 'greeting' && flags.hasListenedToCustomers === false) {
      return true;
    }
    return true;
  },
};
