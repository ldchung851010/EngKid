import type { SceneConfig } from '../../engine/schema/SceneConfig.js';
import { createGrid } from '../../engine/schema/grid-helpers.js';

const WIDTH = 24;
const HEIGHT = 6;
const DEPTH = 18;

function terminal(): string[][] {
  const grid = createGrid(WIDTH, DEPTH, 'AIR');
  for (let x = 0; x < WIDTH; x++) {
    grid[0][x] = 'GLASS';
    if (x < 9 || x > 14) grid[DEPTH - 1][x] = 'WALL';
  }
  for (let z = 0; z < DEPTH; z++) {
    grid[z][0] = 'WALL';
    grid[z][WIDTH - 1] = 'WALL';
  }
  grid[2][11] = 'SIGN';
  grid[2][12] = 'SIGN';
  return grid;
}

export const airportConfig: SceneConfig = {
  schemaVersion: '1.0',
  name: 'Airport',
  description: 'Check in for a flight, ask for a boarding pass, and find the gate.',
  cefrLevel: 'A2',
  targetVocabulary: ['ticket', 'passport', 'boarding pass', 'gate', 'flight', 'bag', 'please'],
  start: {
    position: { x: 12, y: 2.8, z: 16 },
    lookAt: { x: 12, y: 2.3, z: 5 },
  },
  environment: {
    skyColor: 0xcfefff,
    fogColor: 0xcfefff,
    fogNear: 24,
    fogFar: 70,
  },
  map: {
    width: WIDTH,
    height: HEIGHT,
    depth: DEPTH,
    layers: [
      { y: 0, grid: createGrid(WIDTH, DEPTH, 'FLOOR') },
      { y: 1, grid: terminal() },
      { y: 2, grid: terminal() },
      { y: 3, grid: terminal() },
    ],
  },
  npcs: [
    {
      id: 'agent',
      name: 'Alex',
      role: 'A calm airport check-in agent who helps children use simple travel English.',
      position: { x: 12, y: 0, z: 6 },
      appearance: 'airport_agent_male_01',
      voice: 'Kiki',
      speechSpeed: 0.84,
      interaction: { type: 'proximity', radius: 3.1 },
      dialogueTree: [
        {
          id: 'greeting',
          npcText: 'Hello! Welcome to the airport. May I see your ticket or passport?',
          hintExamples: ['Here is my ticket', 'Here is my passport', 'I have my ticket'],
          candidateIntents: [
            {
              intentId: 'show_document',
              description: 'The child says they have or are giving a ticket, passport, or travel document',
              nextNodeId: 'give_boarding_pass',
            },
          ],
          fallbackNodeId: 'ask_again',
        },
        {
          id: 'ask_again',
          npcText: "Try saying, 'Here is my ticket' or 'Here is my passport.'",
          hintExamples: ['Here is my ticket', 'Here is my passport'],
          candidateIntents: [
            {
              intentId: 'show_document',
              description: 'The child says they have or are giving a ticket, passport, or travel document',
              nextNodeId: 'give_boarding_pass',
            },
          ],
          fallbackNodeId: 'give_boarding_pass',
        },
        {
          id: 'give_boarding_pass',
          npcText: 'Thank you. Here is your boarding pass. Please go to Gate B. What gate do you need?',
          hintExamples: ['Gate B', 'I need Gate B', 'My gate is B'],
          candidateIntents: [
            {
              intentId: 'say_gate',
              description: 'The child repeats or identifies the airport gate',
              nextNodeId: 'goodbye',
            },
          ],
          fallbackNodeId: 'goodbye',
        },
        {
          id: 'goodbye',
          npcText: 'Perfect. Have a nice flight! You earned {score} points.',
          hintExamples: [],
          candidateIntents: [],
          isTerminal: true,
        },
      ],
    },
  ],
  tasks: [
    {
      id: 'show_document',
      description: 'Show or mention your ticket or passport.',
      trigger: { type: 'dialogue_node', npcId: 'agent', nodeId: 'greeting' },
      targetIntent: 'show_document',
      scoreReward: 12,
      maxAttempts: 3,
    },
    {
      id: 'say_gate',
      description: 'Say the gate shown on the boarding pass.',
      trigger: { type: 'dialogue_node', npcId: 'agent', nodeId: 'give_boarding_pass' },
      targetIntent: 'say_gate',
      scoreReward: 8,
    },
  ],
};
