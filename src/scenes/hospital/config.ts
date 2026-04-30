import type { SceneConfig } from '../../engine/schema/SceneConfig.js';

const WIDTH = 22;
const HEIGHT = 6;
const DEPTH = 18;

function layer(fill: string): string[][] {
  return Array.from({ length: DEPTH }, () => Array(WIDTH).fill(fill));
}

function walls(): string[][] {
  const grid = layer('AIR');
  for (let x = 0; x < WIDTH; x++) {
    grid[0][x] = x >= 9 && x <= 12 ? 'GLASS' : 'WALL';
    if (x < 8 || x > 13) grid[DEPTH - 1][x] = 'WALL';
  }
  for (let z = 0; z < DEPTH; z++) {
    grid[z][0] = 'WALL';
    grid[z][WIDTH - 1] = 'WALL';
  }
  return grid;
}

export const hospitalConfig: SceneConfig = {
  schemaVersion: '1.0',
  name: 'Hospital',
  description: 'Visit a friendly clinic, explain how you feel, and learn caring health English.',
  cefrLevel: 'A2',
  targetVocabulary: ['doctor', 'nurse', 'headache', 'stomachache', 'medicine', 'water', 'rest', 'help'],
  start: {
    position: { x: 11, y: 2.8, z: 16 },
    lookAt: { x: 11, y: 2.3, z: 5 },
  },
  environment: {
    skyColor: 0xe5fbff,
    fogColor: 0xeafcff,
    fogNear: 22,
    fogFar: 64,
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
      id: 'doctor',
      name: 'Dr. Lee',
      role: 'A gentle doctor who helps children describe symptoms and ask for simple care.',
      position: { x: 11, y: 0, z: 5 },
      appearance: 'doctor_male_01',
      voice: 'Kiki',
      speechSpeed: 0.82,
      interaction: { type: 'proximity', radius: 3.1 },
      dialogueTree: [
        {
          id: 'greeting',
          npcText: 'Hello. I am Dr. Lee. How do you feel today?',
          hintExamples: ['I have a headache', 'My stomach hurts', 'I feel tired'],
          candidateIntents: [
            {
              intentId: 'describe_symptom',
              description: 'The child describes a simple symptom, pain, or feeling such as headache, stomachache, tired, sick, or hurt',
              nextNodeId: 'give_advice',
            },
          ],
          fallbackNodeId: 'ask_again',
        },
        {
          id: 'ask_again',
          npcText: "Try telling me how you feel. You can say, 'I have a headache' or 'My stomach hurts.'",
          hintExamples: ['I have a headache', 'My stomach hurts'],
          candidateIntents: [
            {
              intentId: 'describe_symptom',
              description: 'The child describes a simple symptom, pain, or feeling such as headache, stomachache, tired, sick, or hurt',
              nextNodeId: 'give_advice',
            },
          ],
          fallbackNodeId: 'give_advice',
        },
        {
          id: 'give_advice',
          npcText: 'Thank you for telling me. Please drink water and rest. Can you ask for help politely?',
          hintExamples: ['Can you help me, please?', 'May I have some medicine?', 'I need help, please'],
          candidateIntents: [
            {
              intentId: 'ask_help',
              description: 'The child politely asks for help, medicine, water, or care',
              nextNodeId: 'goodbye',
            },
          ],
          fallbackNodeId: 'goodbye',
        },
        {
          id: 'goodbye',
          npcText: 'Well done. You used kind hospital English and earned {score} points.',
          hintExamples: [],
          candidateIntents: [],
          isTerminal: true,
        },
      ],
    },
  ],
  tasks: [
    {
      id: 'describe_symptom',
      description: 'Tell the doctor how you feel.',
      trigger: { type: 'dialogue_node', npcId: 'doctor', nodeId: 'greeting' },
      targetIntent: 'describe_symptom',
      scoreReward: 12,
      maxAttempts: 3,
    },
    {
      id: 'ask_help',
      description: 'Ask politely for help or care.',
      trigger: { type: 'dialogue_node', npcId: 'doctor', nodeId: 'give_advice' },
      targetIntent: 'ask_help',
      scoreReward: 8,
    },
  ],
};
