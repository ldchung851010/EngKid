/**
 * Session State Machine — XState v5.
 *
 * Manages the full scene session lifecycle:
 *   idle → loading → active → taskInProgress(.dialogue / .scoring) → taskComplete → sessionEnd
 *
 * Holds scene state including conversation history, dialogue retries,
 * and scene-level flags for Hook gating.
 */

import { setup, assign } from 'xstate';

export interface SessionContext {
  sceneId: string | null;
  score: number;
  completedTasks: string[];
  activeTaskId: string | null;
  dialogueRetries: number;
  conversationHistory: Array<{ role: string; text: string }>;
  /** Scene-level mutable flags for Hook gating (e.g., hasListenedToCustomers) */
  sceneFlags: Record<string, unknown>;
}

export type SessionEvent =
  | { type: 'LOAD_SCENE'; sceneId: string }
  | { type: 'ACTIVATE' }
  | { type: 'TASK_TRIGGERED'; taskId: string }
  | { type: 'INTENT_MATCHED'; intentId: string; confidence: number }
  | { type: 'INTENT_NONE' }
  | { type: 'INTENT_RETRY_EXHAUSTED' }
  | { type: 'TASK_COMPLETE' }
  | { type: 'END_SESSION' };

export const sessionMachine = setup({
  types: {
    context: {} as SessionContext,
    events: {} as SessionEvent,
  },
  actions: {
    setSceneId: assign({
      sceneId: ({ event }) => (event.type === 'LOAD_SCENE' ? event.sceneId : ({} as never)),
    }),
    resetSession: assign({
      score: () => 0,
      completedTasks: () => [],
      activeTaskId: () => null,
      dialogueRetries: () => 0,
      conversationHistory: () => [],
      sceneFlags: () => ({}),
    }),
    setActiveTask: assign({
      activeTaskId: ({ event }) => (event.type === 'TASK_TRIGGERED' ? event.taskId : ({} as never)),
      dialogueRetries: () => 0,
    }),
    incrementRetry: assign({
      dialogueRetries: ({ context }) => context.dialogueRetries + 1,
    }),
    recordConversation: assign({
      conversationHistory: ({ context, event }) => {
        if (event.type === 'INTENT_MATCHED') {
          return [...context.conversationHistory, { role: 'system', text: `intent: ${event.intentId}` }];
        }
        return context.conversationHistory;
      },
    }),
    markTaskComplete: assign({
      completedTasks: ({ context }) => {
        if (context.activeTaskId) {
          return [...context.completedTasks, context.activeTaskId];
        }
        return context.completedTasks;
      },
    }),
  },
}).createMachine({
  id: 'session',
  initial: 'idle',
  context: {
    sceneId: null,
    score: 0,
    completedTasks: [],
    activeTaskId: null,
    dialogueRetries: 0,
    conversationHistory: [],
    sceneFlags: {},
  },
  states: {
    idle: {
      on: {
        LOAD_SCENE: {
          target: 'loading',
          actions: ['setSceneId', 'resetSession'],
        },
      },
    },
    loading: {
      // In practice, scene validation runs externally and sends ACTIVATE
      on: {
        ACTIVATE: { target: 'active' },
      },
    },
    active: {
      on: {
        TASK_TRIGGERED: {
          target: 'taskInProgress',
          actions: ['setActiveTask'],
        },
        END_SESSION: { target: 'sessionEnd' },
      },
    },
    taskInProgress: {
      initial: 'dialogue',
      states: {
        dialogue: {
          on: {
            INTENT_MATCHED: {
              target: 'scoring',
              actions: ['recordConversation'],
            },
            INTENT_NONE: {
              actions: ['incrementRetry'],
              // Stay in dialogue — external handler checks retry count
            },
            INTENT_RETRY_EXHAUSTED: {
              target: 'scoring',
            },
          },
        },
        scoring: {
          after: {
            500: 'complete',
          },
        },
        complete: { type: 'final' as const },
      },
      onDone: {
        target: 'taskComplete',
        actions: ['markTaskComplete'],
      },
    },
    taskComplete: {
      on: {
        TASK_TRIGGERED: {
          target: 'taskInProgress',
          actions: ['setActiveTask'],
        },
        END_SESSION: { target: 'sessionEnd' },
        LOAD_SCENE: {
          target: 'loading',
          actions: ['setSceneId'],
          // Note: score preserved across scene switches (R4)
        },
      },
    },
    sessionEnd: {
      on: {
        LOAD_SCENE: {
          target: 'loading',
          actions: ['setSceneId', 'resetSession'],
        },
      },
    },
  },
});
