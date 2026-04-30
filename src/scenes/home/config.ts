import type { SceneConfig } from '../../engine/schema/SceneConfig.js';

const WIDTH = 20;
const HEIGHT = 6;
const DEPTH = 18;

function layer(fill: string): string[][] {
  return Array.from({ length: DEPTH }, () => Array(WIDTH).fill(fill));
}

function walls(): string[][] {
  const grid = layer('AIR');
  for (let x = 0; x < WIDTH; x++) {
    grid[0][x] = 'WALL';
    if (x < 7 || x > 12) grid[DEPTH - 1][x] = 'WALL';
  }
  for (let z = 0; z < DEPTH; z++) {
    grid[z][0] = 'WALL';
    grid[z][WIDTH - 1] = 'WALL';
  }
  return grid;
}

export const homeConfig: SceneConfig = {
  schemaVersion: '1.0',
  name: 'Home',
  description: 'Practice warm family English at home: rooms, chores, and polite help.',
  cefrLevel: 'A1',
  targetVocabulary: ['home', 'bed', 'table', 'sofa', 'lamp', 'kitchen', 'clean', 'help'],
  start: {
    position: { x: 10, y: 2.8, z: 16 },
    lookAt: { x: 10, y: 2.3, z: 5 },
  },
  environment: {
    skyColor: 0xffefd8,
    fogColor: 0xffefd8,
    fogNear: 20,
    fogFar: 56,
  },
  map: {
    width: WIDTH,
    height: HEIGHT,
    depth: DEPTH,
    layers: [
      { y: 0, grid: layer('FLOOR') },
      { y: 1, grid: walls() },
      { y: 2, grid: walls() },
      { y: 3, grid: walls() },
    ],
  },
  npcs: [
    {
      id: 'sibling',
      name: 'Ben',
      role: 'A kind older sibling who helps children talk about home rooms, chores, and helping family.',
      position: { x: 10, y: 0, z: 5 },
      appearance: 'sibling_child_01',
      voice: 'Kiki',
      speechSpeed: 0.88,
      interaction: { type: 'proximity', radius: 3 },
      dialogueTree: [
        {
          id: 'greeting',
          npcText: 'Welcome home! We are tidying up. What room or thing can you name?',
          hintExamples: ['This is the kitchen', 'I see a sofa', 'There is a bed'],
          candidateIntents: [
            {
              intentId: 'name_home_item',
              description: 'The child names a home room or object such as kitchen, bed, sofa, lamp, table, or home',
              nextNodeId: 'ask_chore',
            },
          ],
          fallbackNodeId: 'ask_again',
        },
        {
          id: 'ask_again',
          npcText: "Look around and name one thing. You can say, 'I see a sofa.'",
          hintExamples: ['I see a sofa', 'This is the kitchen'],
          candidateIntents: [
            {
              intentId: 'name_home_item',
              description: 'The child names a home room or object such as kitchen, bed, sofa, lamp, table, or home',
              nextNodeId: 'ask_chore',
            },
          ],
          fallbackNodeId: 'ask_chore',
        },
        {
          id: 'ask_chore',
          npcText: 'Great! Can you offer to help at home?',
          hintExamples: ['I can help clean', 'Let me clean the table', 'Can I help?'],
          candidateIntents: [
            {
              intentId: 'offer_help',
              description: 'The child offers help, asks to help, or says they can clean or tidy something',
              nextNodeId: 'goodbye',
            },
          ],
          fallbackNodeId: 'goodbye',
        },
        {
          id: 'goodbye',
          npcText: 'That was kind and clear. You earned {score} points at home!',
          hintExamples: [],
          candidateIntents: [],
          isTerminal: true,
        },
      ],
    },
  ],
  tasks: [
    {
      id: 'name_home_item',
      description: 'Name a room or object at home.',
      trigger: { type: 'dialogue_node', npcId: 'sibling', nodeId: 'greeting' },
      targetIntent: 'name_home_item',
      scoreReward: 10,
      maxAttempts: 3,
    },
    {
      id: 'offer_help',
      description: 'Offer to help with a home chore.',
      trigger: { type: 'dialogue_node', npcId: 'sibling', nodeId: 'ask_chore' },
      targetIntent: 'offer_help',
      scoreReward: 8,
    },
  ],
};
