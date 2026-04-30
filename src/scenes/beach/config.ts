import type { SceneConfig } from '../../engine/schema/SceneConfig.js';

const WIDTH = 24;
const HEIGHT = 6;
const DEPTH = 20;

function layer(fill: string): string[][] {
  return Array.from({ length: DEPTH }, () => Array(WIDTH).fill(fill));
}

function ground(): string[][] {
  const grid = layer('FLOOR');
  for (let z = 0; z < 6; z++) {
    for (let x = 0; x < WIDTH; x++) grid[z][x] = 'WATER';
  }
  for (let x = 10; x <= 13; x++) {
    for (let z = 6; z < DEPTH; z++) grid[z][x] = 'FLOOR';
  }
  return grid;
}

function edges(): string[][] {
  const grid = layer('AIR');
  for (let x = 0; x < WIDTH; x++) grid[DEPTH - 1][x] = 'WALL';
  for (let z = 0; z < DEPTH; z++) {
    grid[z][0] = 'WALL';
    grid[z][WIDTH - 1] = 'WALL';
  }
  return grid;
}

export const beachConfig: SceneConfig = {
  schemaVersion: '1.0',
  name: 'Beach',
  description: 'Explore the beach, talk about weather, and ask a lifeguard for safe fun.',
  cefrLevel: 'A1',
  targetVocabulary: ['beach', 'sand', 'sea', 'shell', 'sun', 'hat', 'swim', 'water'],
  start: {
    position: { x: 12, y: 2.8, z: 17 },
    lookAt: { x: 12, y: 2.15, z: 6 },
  },
  environment: {
    skyColor: 0x9fe7ff,
    fogColor: 0xcdf7ff,
    fogNear: 28,
    fogFar: 78,
  },
  map: {
    width: WIDTH,
    height: HEIGHT,
    depth: DEPTH,
    layers: [
      { y: 0, grid: ground() },
      { y: 1, grid: edges() },
      { y: 2, grid: edges() },
    ],
  },
  npcs: [
    {
      id: 'lifeguard',
      name: 'Sam',
      role: 'A cheerful lifeguard who teaches beach words, weather talk, and simple safety phrases.',
      position: { x: 12, y: 0, z: 8 },
      appearance: 'lifeguard_male_01',
      voice: 'Kiki',
      speechSpeed: 0.86,
      interaction: { type: 'proximity', radius: 3.2 },
      dialogueTree: [
        {
          id: 'greeting',
          npcText: 'Hello from the beach! What is the weather like today?',
          hintExamples: ['It is sunny', 'It is hot today', 'The sun is bright'],
          candidateIntents: [
            {
              intentId: 'say_weather',
              description: 'The child describes beach weather, sun, heat, wind, or a sunny day',
              nextNodeId: 'ask_activity',
            },
          ],
          fallbackNodeId: 'ask_again',
        },
        {
          id: 'ask_again',
          npcText: "Try a weather sentence. You can say, 'It is sunny.'",
          hintExamples: ['It is sunny', 'It is hot'],
          candidateIntents: [
            {
              intentId: 'say_weather',
              description: 'The child describes beach weather, sun, heat, wind, or a sunny day',
              nextNodeId: 'ask_activity',
            },
          ],
          fallbackNodeId: 'ask_activity',
        },
        {
          id: 'ask_activity',
          npcText: 'Great! What do you want to do at the beach?',
          hintExamples: ['I want to swim', 'I want to find shells', 'Can I drink water?'],
          candidateIntents: [
            {
              intentId: 'choose_beach_activity',
              description: 'The child chooses a beach activity such as swimming, finding shells, playing in sand, wearing a hat, or drinking water',
              nextNodeId: 'goodbye',
            },
          ],
          fallbackNodeId: 'goodbye',
        },
        {
          id: 'goodbye',
          npcText: 'Great beach talk! Stay safe, wear your hat, and enjoy {score} points.',
          hintExamples: [],
          candidateIntents: [],
          isTerminal: true,
        },
      ],
    },
  ],
  tasks: [
    {
      id: 'say_weather',
      description: 'Say what the beach weather is like.',
      trigger: { type: 'dialogue_node', npcId: 'lifeguard', nodeId: 'greeting' },
      targetIntent: 'say_weather',
      scoreReward: 10,
      maxAttempts: 3,
    },
    {
      id: 'choose_beach_activity',
      description: 'Choose something fun and safe to do at the beach.',
      trigger: { type: 'dialogue_node', npcId: 'lifeguard', nodeId: 'ask_activity' },
      targetIntent: 'choose_beach_activity',
      scoreReward: 8,
    },
  ],
};
