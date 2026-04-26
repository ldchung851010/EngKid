import type { SceneConfig } from '../../engine/schema/SceneConfig.js';

const RESTAURANT_WIDTH = 18;
const RESTAURANT_HEIGHT = 4;
const RESTAURANT_DEPTH = 16;

function createLayer(fill: string): string[][] {
  return Array.from({ length: RESTAURANT_DEPTH }, () => Array(RESTAURANT_WIDTH).fill(fill));
}

function createWallLayer(): string[][] {
  const grid = createLayer('AIR');
  for (let x = 0; x < RESTAURANT_WIDTH; x++) {
    grid[0][x] = 'WALL';
  }
  for (let z = 0; z < RESTAURANT_DEPTH - 1; z++) {
    grid[z][0] = 'WALL';
    grid[z][RESTAURANT_WIDTH - 1] = 'WALL';
  }
  for (let x = 0; x < RESTAURANT_WIDTH; x++) {
    if (x < 6 || x > 11) grid[RESTAURANT_DEPTH - 1][x] = 'WALL';
  }
  return grid;
}

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
    width: RESTAURANT_WIDTH,
    height: RESTAURANT_HEIGHT,
    depth: RESTAURANT_DEPTH,
    layers: [
      { y: 0, grid: createLayer('FLOOR') },
      { y: 1, grid: createWallLayer() },
      { y: 2, grid: createWallLayer() },
    ],
  },

  npcs: [
    {
      id: 'waiter',
      name: 'Tom',
      role: 'A cheerful cartoon waiter who welcomes children, helps them order food, and encourages polite restaurant English.',
      position: { x: 9, y: 0, z: 4 },
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
