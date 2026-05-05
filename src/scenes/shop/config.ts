import type { SceneConfig } from '../../engine/schema/SceneConfig.js';
import { createGrid } from '../../engine/schema/grid-helpers.js';

const WIDTH = 22;
const HEIGHT = 6;
const DEPTH = 18;

function walls(): string[][] {
  const grid = createGrid(WIDTH, DEPTH, 'AIR');
  for (let x = 0; x < WIDTH; x++) {
    grid[0][x] = 'GLASS';
    if (x < 8 || x > 13) grid[DEPTH - 1][x] = 'WALL';
  }
  for (let z = 0; z < DEPTH; z++) {
    grid[z][0] = 'WALL';
    grid[z][WIDTH - 1] = 'WALL';
  }
  return grid;
}

export const shopConfig: SceneConfig = {
  schemaVersion: '1.0',
  name: 'Shop',
  description: 'Buy snacks and toys from a cheerful shopkeeper using polite money English.',
  cefrLevel: 'A1',
  targetVocabulary: ['shop', 'apple', 'milk', 'bread', 'toy', 'price', 'money', 'bag'],
  start: {
    position: { x: 11, y: 2.8, z: 16 },
    lookAt: { x: 11, y: 2.25, z: 5 },
  },
  environment: {
    skyColor: 0xfff3d6,
    fogColor: 0xfff7df,
    fogNear: 22,
    fogFar: 60,
  },
  map: {
    width: WIDTH,
    height: HEIGHT,
    depth: DEPTH,
    layers: [
      { y: 0, grid: createGrid(WIDTH, DEPTH, 'FLOOR') },
      { y: 1, grid: walls() },
      { y: 2, grid: walls() },
      { y: 3, grid: walls() },
    ],
  },
  npcs: [
    {
      id: 'shopkeeper',
      name: 'Nora',
      role: 'A bright shopkeeper who helps children ask for items, prices, and bags politely.',
      position: { x: 11, y: 0, z: 5 },
      appearance: 'shopkeeper_female_01',
      voice: 'Kiki',
      speechSpeed: 0.87,
      interaction: { type: 'proximity', radius: 3.1 },
      dialogueTree: [
        {
          id: 'greeting',
          npcText: 'Welcome to Happy Shop! What would you like to buy?',
          hintExamples: ['I want an apple, please', 'Can I buy milk?', 'I would like a toy'],
          candidateIntents: [
            {
              intentId: 'buy_item',
              description: 'The child asks to buy an item such as apple, milk, bread, toy, or another shop item',
              nextNodeId: 'ask_price',
            },
          ],
          fallbackNodeId: 'ask_again',
        },
        {
          id: 'ask_again',
          npcText: "Pick something from the shelves. Try, 'I want an apple, please.'",
          hintExamples: ['I want an apple, please', 'Can I buy bread?'],
          candidateIntents: [
            {
              intentId: 'buy_item',
              description: 'The child asks to buy an item such as apple, milk, bread, toy, or another shop item',
              nextNodeId: 'ask_price',
            },
          ],
          fallbackNodeId: 'ask_price',
        },
        {
          id: 'ask_price',
          npcText: 'Good choice! It is three dollars. Can you ask about the price or pay?',
          hintExamples: ['How much is it?', 'Here is the money', 'It is three dollars'],
          candidateIntents: [
            {
              intentId: 'handle_price',
              description: 'The child asks how much it is, says the price, or says they are paying money',
              nextNodeId: 'goodbye',
            },
          ],
          fallbackNodeId: 'goodbye',
        },
        {
          id: 'goodbye',
          npcText: 'Thank you for shopping! Here is your bag. You earned {score} points.',
          hintExamples: [],
          candidateIntents: [],
          isTerminal: true,
        },
      ],
    },
  ],
  tasks: [
    {
      id: 'buy_item',
      description: 'Ask the shopkeeper to buy an item.',
      trigger: { type: 'dialogue_node', npcId: 'shopkeeper', nodeId: 'greeting' },
      targetIntent: 'buy_item',
      scoreReward: 10,
      maxAttempts: 3,
    },
    {
      id: 'handle_price',
      description: 'Ask the price or pay for the item.',
      trigger: { type: 'dialogue_node', npcId: 'shopkeeper', nodeId: 'ask_price' },
      targetIntent: 'handle_price',
      scoreReward: 8,
    },
  ],
};
