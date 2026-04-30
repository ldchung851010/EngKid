import type { SceneConfig } from '../../engine/schema/SceneConfig.js';

const WIDTH = 24;
const HEIGHT = 6;
const DEPTH = 20;

function layer(fill: string): string[][] {
  return Array.from({ length: DEPTH }, () => Array(WIDTH).fill(fill));
}

function ground(): string[][] {
  const grid = layer('GRASS');
  for (let z = 0; z < DEPTH; z++) {
    grid[z][11] = 'FLOOR';
    grid[z][12] = 'FLOOR';
  }
  for (let x = 3; x <= 20; x++) {
    grid[10][x] = 'FLOOR';
    grid[11][x] = 'FLOOR';
  }
  for (let x = 2; x <= 5; x++) {
    for (let z = 3; z <= 6; z++) grid[z][x] = 'WATER';
  }
  return grid;
}

function fence(): string[][] {
  const grid = layer('AIR');
  for (let x = 0; x < WIDTH; x++) {
    grid[0][x] = 'WALL';
    grid[DEPTH - 1][x] = 'WALL';
  }
  for (let z = 0; z < DEPTH; z++) {
    grid[z][0] = 'WALL';
    grid[z][WIDTH - 1] = 'WALL';
  }
  return grid;
}

export const parkConfig: SceneConfig = {
  schemaVersion: '1.0',
  name: 'Park',
  description: 'Play in a sunny park, invite a friend, and talk about outdoor activities.',
  cefrLevel: 'A1',
  targetVocabulary: ['park', 'tree', 'flower', 'bench', 'ball', 'kite', 'play', 'run'],
  start: {
    position: { x: 12, y: 2.8, z: 17 },
    lookAt: { x: 12, y: 2.2, z: 8 },
  },
  environment: {
    skyColor: 0xb7e9ff,
    fogColor: 0xd4f7cf,
    fogNear: 26,
    fogFar: 74,
  },
  map: {
    width: WIDTH,
    height: HEIGHT,
    depth: DEPTH,
    layers: [
      { y: 0, grid: ground() },
      { y: 1, grid: fence() },
      { y: 2, grid: fence() },
    ],
  },
  npcs: [
    {
      id: 'park_friend',
      name: 'Mia',
      role: 'An energetic park friend who invites children to play and describe outdoor things.',
      position: { x: 12, y: 0, z: 7 },
      appearance: 'friend_child_01',
      voice: 'Kiki',
      speechSpeed: 0.88,
      interaction: { type: 'proximity', radius: 3.2 },
      dialogueTree: [
        {
          id: 'greeting',
          npcText: 'Hi! It is a beautiful day at the park. What do you want to play?',
          hintExamples: ["Let's play ball", 'I want to fly a kite', 'Can we run?'],
          candidateIntents: [
            {
              intentId: 'choose_activity',
              description: 'The child chooses an outdoor activity such as playing ball, flying a kite, running, or playing together',
              nextNodeId: 'describe_park',
            },
          ],
          fallbackNodeId: 'try_activity',
        },
        {
          id: 'try_activity',
          npcText: "Try saying, 'Let's play ball' or 'I want to fly a kite.'",
          hintExamples: ["Let's play ball", 'I want to run'],
          candidateIntents: [
            {
              intentId: 'choose_activity',
              description: 'The child chooses an outdoor activity such as playing ball, flying a kite, running, or playing together',
              nextNodeId: 'describe_park',
            },
          ],
          fallbackNodeId: 'describe_park',
        },
        {
          id: 'describe_park',
          npcText: 'Great idea! Before we play, tell me one thing you can see in the park.',
          hintExamples: ['I see a tree', 'I see flowers', 'There is a bench'],
          candidateIntents: [
            {
              intentId: 'describe_park_item',
              description: 'The child names or describes something visible in the park, such as a tree, flower, bench, kite, or ball',
              nextNodeId: 'goodbye',
            },
          ],
          fallbackNodeId: 'goodbye',
        },
        {
          id: 'goodbye',
          npcText: 'Nice park English! You earned {score} points. Let us play!',
          hintExamples: [],
          candidateIntents: [],
          isTerminal: true,
        },
      ],
    },
  ],
  tasks: [
    {
      id: 'choose_activity',
      description: 'Choose a park activity with your friend.',
      trigger: { type: 'dialogue_node', npcId: 'park_friend', nodeId: 'greeting' },
      targetIntent: 'choose_activity',
      scoreReward: 10,
      maxAttempts: 3,
    },
    {
      id: 'describe_park_item',
      description: 'Describe one thing you can see in the park.',
      trigger: { type: 'dialogue_node', npcId: 'park_friend', nodeId: 'describe_park' },
      targetIntent: 'describe_park_item',
      scoreReward: 8,
    },
  ],
};
