import type { SceneConfig } from '../../engine/schema/SceneConfig.js';

const WIDTH = 22;
const HEIGHT = 6;
const DEPTH = 18;

function layer(fill: string): string[][] {
  return Array.from({ length: DEPTH }, () => Array(WIDTH).fill(fill));
}

function ground(): string[][] {
  const grid = layer('GRASS');
  for (let x = 8; x <= 13; x++) {
    for (let z = 0; z < DEPTH; z++) grid[z][x] = 'FLOOR';
  }
  for (let x = 2; x <= 5; x++) {
    for (let z = 4; z <= 8; z++) grid[z][x] = 'WATER';
  }
  return grid;
}

function fences(): string[][] {
  const grid = layer('AIR');
  for (let x = 0; x < WIDTH; x++) {
    grid[0][x] = 'WALL';
    grid[DEPTH - 1][x] = 'WALL';
  }
  for (let z = 0; z < DEPTH; z++) {
    grid[z][0] = 'WALL';
    grid[z][WIDTH - 1] = 'WALL';
  }
  grid[15][10] = 'SIGN';
  grid[15][11] = 'SIGN';
  return grid;
}

export const zooConfig: SceneConfig = {
  schemaVersion: '1.0',
  name: 'Zoo',
  description: 'Meet a zookeeper and talk about animals, colors, and simple directions.',
  cefrLevel: 'A1',
  targetVocabulary: ['lion', 'monkey', 'elephant', 'bird', 'tiger', 'big', 'small', 'where'],
  start: {
    position: { x: 11, y: 2.8, z: 14.2 },
    lookAt: { x: 11, y: 2.2, z: 7 },
  },
  environment: {
    skyColor: 0xb3e5fc,
    fogColor: 0xc8f7d3,
    fogNear: 24,
    fogFar: 70,
  },
  map: {
    width: WIDTH,
    height: HEIGHT,
    depth: DEPTH,
    layers: [
      { y: 0, grid: ground() },
      { y: 1, grid: fences() },
      { y: 2, grid: fences() },
    ],
  },
  npcs: [
    {
      id: 'zookeeper',
      name: 'Lily',
      role: 'A friendly zookeeper who helps children ask about animals and describe what they see.',
      position: { x: 11, y: 0, z: 6 },
      appearance: 'zookeeper_female_01',
      voice: 'Kiki',
      speechSpeed: 0.88,
      interaction: { type: 'proximity', radius: 3.2 },
      dialogueTree: [
        {
          id: 'greeting',
          npcText: 'Welcome to the zoo! What animal would you like to see?',
          hintExamples: ['I want to see the lion', 'Where is the monkey?', 'Can I see the elephant?'],
          candidateIntents: [
            {
              intentId: 'ask_animal',
              description: 'The child asks to see or find an animal at the zoo',
              nextNodeId: 'animal_reply',
            },
          ],
          fallbackNodeId: 'ask_again',
        },
        {
          id: 'ask_again',
          npcText: "Try asking for an animal. You can say, 'I want to see the lion.'",
          hintExamples: ['I want to see the lion', 'Where is the bird?'],
          candidateIntents: [
            {
              intentId: 'ask_animal',
              description: 'The child asks to see or find an animal at the zoo',
              nextNodeId: 'animal_reply',
            },
          ],
          fallbackNodeId: 'animal_reply',
        },
        {
          id: 'animal_reply',
          npcText: 'Great question! The animals are near the green fence. Can you describe one animal?',
          hintExamples: ['The lion is big', 'The bird is small', 'The monkey is funny'],
          candidateIntents: [
            {
              intentId: 'describe_animal',
              description: 'The child describes an animal using a simple adjective',
              nextNodeId: 'goodbye',
            },
          ],
          fallbackNodeId: 'goodbye',
        },
        {
          id: 'goodbye',
          npcText: 'Nice speaking! You earned {score} points. Enjoy the zoo!',
          hintExamples: [],
          candidateIntents: [],
          isTerminal: true,
        },
      ],
    },
  ],
  tasks: [
    {
      id: 'ask_animal',
      description: 'Ask the zookeeper where an animal is.',
      trigger: { type: 'dialogue_node', npcId: 'zookeeper', nodeId: 'greeting' },
      targetIntent: 'ask_animal',
      scoreReward: 10,
      maxAttempts: 3,
    },
    {
      id: 'describe_animal',
      description: 'Describe an animal with a simple adjective.',
      trigger: { type: 'dialogue_node', npcId: 'zookeeper', nodeId: 'animal_reply' },
      targetIntent: 'describe_animal',
      scoreReward: 8,
    },
  ],
};
