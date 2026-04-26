import type { SessionContext } from '../../engine/runtime/SessionMachine.js';

/**
 * Restaurant scene hooks.
 * V1: 2-3 explicit function callbacks for scene-specific logic.
 *
 * The `sceneFlags` field in SessionContext stores mutable scene state
 * accessible to hooks (e.g., { hasListenedToCustomers: false }).
 */
export const restaurantHooks = {
  /**
   * Called before dialogue starts with an NPC.
   * Return false to block/prevent the dialogue from starting.
   */
  onBeforeDialogue(npcId: string, nodeId: string, ctx: SessionContext): boolean {
    // Example gate: if this is a demo showing non-linear branching,
    // require the child to have observed two NPCs talking before ordering.
    // In V1, this runs unconditionally (always allow dialogue).
    void npcId;
    void nodeId;

    const flags = ctx.sceneFlags as Record<string, unknown>;
    if (npcId === 'waiter' && nodeId === 'greeting' && flags.hasListenedToCustomers === false) {
      // Demo hook — in V1 always passes. Remove this branch for production.
      return true;
    }

    return true;
  },

  /**
   * Called after intent is matched.
   * Can override the default score.
   */
  onIntentMatched(intentId: string, defaultScore: number, _ctx: SessionContext): number {
    // Bonus points for specific intents
    if (intentId === 'order_more') return defaultScore + 5;
    return defaultScore;
  },

  /**
   * Called when a task completes.
   * Can trigger side effects.
   */
  onTaskComplete(_taskId: string, _ctx: SessionContext): void {
    // Reserved for future effects
  },
};
