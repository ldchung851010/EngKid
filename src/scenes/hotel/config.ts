import type { SceneConfig } from '../../engine/schema/SceneConfig.js';

const WIDTH = 20;
const HEIGHT = 6;
const DEPTH = 18;

function layer(fill: string): string[][] {
  return Array.from({ length: DEPTH }, () => Array(WIDTH).fill(fill));
}

function lobby(): string[][] {
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

export const hotelConfig: SceneConfig = {
  schemaVersion: '1.0',
  name: 'Hotel',
  description: 'Check in at a hotel, ask for a room, and practice polite travel English.',
  cefrLevel: 'A2',
  targetVocabulary: ['room', 'key', 'night', 'reservation', 'passport', 'please', 'thank you'],
  start: {
    position: { x: 10, y: 2.7, z: 16 },
    lookAt: { x: 10, y: 2.3, z: 4 },
  },
  environment: {
    skyColor: 0xf6e7d8,
    fogColor: 0xf6e7d8,
    fogNear: 22,
    fogFar: 58,
  },
  map: {
    width: WIDTH,
    height: HEIGHT,
    depth: DEPTH,
    layers: [
      { y: 0, grid: layer('FLOOR') },
      { y: 1, grid: lobby() },
      { y: 2, grid: lobby() },
      { y: 3, grid: lobby() },
    ],
  },
  npcs: [
    {
      id: 'receptionist',
      name: 'Emma',
      role: 'A helpful hotel receptionist who guides children through check-in with simple, polite English.',
      position: { x: 10, y: 0, z: 5 },
      appearance: 'receptionist_female_01',
      voice: 'Kiki',
      speechSpeed: 0.84,
      interaction: { type: 'proximity', radius: 3 },
      dialogueTree: [
        {
          id: 'greeting',
          npcText: 'Hello! Welcome to Sunny Hotel. How can I help you?',
          hintExamples: ['I have a reservation', 'I need a room, please', 'Can I check in?'],
          candidateIntents: [
            {
              intentId: 'check_in',
              description: 'The child says they want to check in, have a reservation, or need a hotel room',
              nextNodeId: 'ask_nights',
            },
          ],
          fallbackNodeId: 'ask_again',
        },
        {
          id: 'ask_again',
          npcText: "Try checking in. You can say, 'I have a reservation' or 'I need a room, please.'",
          hintExamples: ['I have a reservation', 'I need a room, please'],
          candidateIntents: [
            {
              intentId: 'check_in',
              description: 'The child says they want to check in, have a reservation, or need a hotel room',
              nextNodeId: 'ask_nights',
            },
          ],
          fallbackNodeId: 'ask_nights',
        },
        {
          id: 'ask_nights',
          npcText: 'Great. How many nights will you stay?',
          hintExamples: ['One night', 'Two nights', 'Three nights, please'],
          candidateIntents: [
            {
              intentId: 'say_nights',
              description: 'The child says how many nights they will stay',
              nextNodeId: 'give_key',
            },
          ],
          fallbackNodeId: 'give_key',
        },
        {
          id: 'give_key',
          npcText: 'Thank you. Here is your room key. You earned {score} points!',
          hintExamples: [],
          candidateIntents: [],
          isTerminal: true,
        },
      ],
    },
  ],
  tasks: [
    {
      id: 'check_in',
      description: 'Tell the receptionist you want to check in.',
      trigger: { type: 'dialogue_node', npcId: 'receptionist', nodeId: 'greeting' },
      targetIntent: 'check_in',
      scoreReward: 12,
      maxAttempts: 3,
    },
    {
      id: 'say_nights',
      description: 'Say how many nights you will stay.',
      trigger: { type: 'dialogue_node', npcId: 'receptionist', nodeId: 'ask_nights' },
      targetIntent: 'say_nights',
      scoreReward: 8,
    },
  ],
};
