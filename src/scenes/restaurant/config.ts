import type { SceneConfig } from '../../engine/schema/SceneConfig.js';

/**
 * V1 Restaurant Scene — hardcoded config.
 *
 * A small restaurant with a waiter NPC. The child approaches the waiter,
 * holds the mic button to speak their order, and receives score feedback.
 */
export const restaurantConfig: SceneConfig = {
  schemaVersion: '1.0',
  name: 'Restaurant',
  description: 'A cozy restaurant where you can order food from a friendly waiter.',
  cefrLevel: 'A1',
  targetVocabulary: ['hamburger', 'pizza', 'salad', 'pasta', 'water', 'juice', 'cola'],

  map: {
    width: 12,
    height: 4,
    depth: 12,
    layers: [
      // Floor (y=0): all FLOOR
      { y: 0, grid: Array.from({ length: 12 }, () => Array(12).fill('FLOOR')) },
      // Walls + furniture (y=1)
      {
        y: 1,
        grid: [
          ['WALL', 'WALL',  'WALL',  'WALL',  'WALL',  'WALL',  'WALL',  'WALL',  'WALL',  'WALL',  'WALL',  'WALL'],
          ['WALL', 'AIR',   'AIR',   'CHAIR', 'AIR',   'CHAIR', 'AIR',   'AIR',   'CHAIR', 'AIR',   'AIR',   'WALL'],
          ['WALL', 'CHAIR', 'AIR',   'TABLE', 'AIR',   'AIR',   'AIR',   'AIR',   'TABLE', 'AIR',   'CHAIR', 'WALL'],
          ['WALL', 'AIR',   'CHAIR', 'AIR',   'AIR',   'AIR',   'COUNTER','COUNTER','COUNTER','COUNTER','AIR', 'WALL'],
          ['WALL', 'CHAIR', 'AIR',   'TABLE', 'AIR',   'AIR',   'AIR',   'AIR',   'TABLE', 'AIR',   'CHAIR', 'WALL'],
          ['WALL', 'AIR',   'AIR',   'CHAIR', 'AIR',   'CHAIR', 'AIR',   'AIR',   'CHAIR', 'AIR',   'AIR',   'WALL'],
          ['WALL', 'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'WALL'],
          ['WALL', 'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'WALL'],
          ['WALL', 'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'WALL'],
          ['WALL', 'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'WALL'],
          ['WALL', 'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'AIR',   'WALL'],
          ['WALL', 'WALL',  'WALL',  'WALL',  'WALL',  'WALL',  'AIR',   'AIR',   'WALL',  'WALL',  'WALL',  'WALL'],
        ],
      },
      // Walls (y=2): perimeter only
      {
        y: 2,
        grid: [
          ['WALL','WALL','WALL','WALL','WALL','WALL','WALL','WALL','WALL','WALL','WALL','WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','WALL','WALL','WALL','WALL','WALL','AIR', 'AIR', 'WALL','WALL','WALL','WALL'],
        ],
      },
      // Walls (y=3): perimeter only
      {
        y: 3,
        grid: [
          ['WALL','WALL','WALL','WALL','WALL','WALL','WALL','WALL','WALL','WALL','WALL','WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'AIR', 'WALL'],
          ['WALL','WALL','WALL','WALL','WALL','WALL','AIR', 'AIR', 'WALL','WALL','WALL','WALL'],
        ],
      },
    ],
  },

  npcs: [
    {
      id: 'waiter',
      name: 'Tom',
      role: 'A friendly waiter at the restaurant who takes food orders from customers.',
      position: { x: 6, y: 0, z: 3 },
      appearance: 'waiter_male_01',
      voice: 'expr-voice-2-m',
      speechSpeed: 0.85,
      interaction: { type: 'proximity', radius: 3 },
      dialogueTree: [
        {
          id: 'greeting',
          npcText: 'Welcome to our restaurant! What would you like to order?',
          hintExamples: [
            "I'd like a hamburger",
            'Can I have pizza, please?',
            'A salad, please',
          ],
          candidateIntents: [
            {
              intentId: 'order_food',
              description: 'The child ordered some food or drink from the menu',
              nextNodeId: 'confirm_order',
            },
          ],
          fallbackNodeId: 'ask_again',
        },
        {
          id: 'ask_again',
          npcText: "Sorry, I didn't quite catch that. You can say things like 'I'd like a hamburger' or 'Can I have pizza?' — what sounds good?",
          hintExamples: [
            "I'd like a hamburger",
            'Pizza, please',
            'A salad',
          ],
          candidateIntents: [
            {
              intentId: 'order_food',
              description: 'The child ordered some food or drink from the menu',
              nextNodeId: 'confirm_order',
            },
          ],
          fallbackNodeId: 'demonstrate',
        },
        {
          id: 'demonstrate',
          npcText: "That's okay! Just say 'I'd like a hamburger' — go ahead, press the mic button and try!",
          hintExamples: ["I'd like a hamburger"],
          candidateIntents: [
            {
              intentId: 'order_food',
              description: 'The child ordered some food or drink from the menu',
              nextNodeId: 'confirm_order',
            },
          ],
          fallbackNodeId: 'confirm_order', // After 3 retries, advance anyway
        },
        {
          id: 'confirm_order',
          npcText: "Great choice! Coming right up. You earned {score} points! Would you like anything else?",
          hintExamples: ['No, thank you', "That's all", 'Yes, some juice please'],
          candidateIntents: [
            {
              intentId: 'order_more',
              description: 'The child wants to order more food or drinks',
              nextNodeId: 'greeting',
            },
            {
              intentId: 'order_done',
              description: "The child says no, no thanks, no thank you, that's all, or otherwise declines to order anything else",
              nextNodeId: 'goodbye',
            },
          ],
          fallbackNodeId: 'goodbye',
        },
        {
          id: 'goodbye',
          npcText: 'Enjoy your meal! Come back anytime!',
          hintExamples: [],
          candidateIntents: [],
          isTerminal: true,
        },
      ],
    },
  ],

  tasks: [
    {
      id: 'order_food',
      description: 'Order food from the waiter by speaking your order into the microphone.',
      trigger: { type: 'dialogue_node', npcId: 'waiter', nodeId: 'greeting' },
      targetIntent: 'order_food',
      scoreReward: 10,
      maxAttempts: 3,
    },
  ],
};
