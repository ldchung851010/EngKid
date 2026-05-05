import type { SceneConfig } from '../../engine/schema/SceneConfig.js';
import { createGrid } from '../../engine/schema/grid-helpers.js';

const WIDTH = 24;
const HEIGHT = 6;
const DEPTH = 20;

function ground(): string[][] {
  const grid = createGrid(WIDTH, DEPTH, 'GRASS');
  for (let z = 0; z < DEPTH; z++) {
    grid[z][11] = 'ROAD';
    grid[z][12] = 'ROAD';
  }
  for (let x = 3; x <= 8; x++) {
    for (let z = 4; z <= 12; z++) grid[z][x] = 'FLOOR';
  }
  for (let x = 16; x <= 21; x++) {
    for (let z = 4; z <= 12; z++) grid[z][x] = 'FLOOR';
  }
  return grid;
}

function fences(): string[][] {
  const grid = createGrid(WIDTH, DEPTH, 'AIR');
  for (let x = 0; x < WIDTH; x++) {
    grid[0][x] = 'WALL';
    if (x < 9 || x > 14) grid[DEPTH - 1][x] = 'WALL';
  }
  for (let z = 0; z < DEPTH; z++) {
    grid[z][0] = 'WALL';
    grid[z][WIDTH - 1] = 'WALL';
  }
  return grid;
}

export const farmConfig: SceneConfig = {
  schemaVersion: '1.0',
  name: 'Farm',
  description: 'Meet a farmer, name animals and foods, and talk about simple farm jobs.',
  cefrLevel: 'A1',
  targetVocabulary: ['farm', 'cow', 'chicken', 'sheep', 'egg', 'milk', 'tractor', 'water'],
  start: {
    position: { x: 12, y: 2.8, z: 17 },
    lookAt: { x: 12, y: 2.2, z: 7 },
  },
  environment: {
    skyColor: 0xb9eaff,
    fogColor: 0xd8f7c7,
    fogNear: 26,
    fogFar: 74,
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
      id: 'farmer',
      name: 'Grace',
      role: 'A friendly farmer who helps children name farm animals, foods, and helpful chores.',
      position: { x: 12, y: 0, z: 7 },
      appearance: 'farmer_female_01',
      voice: 'Kiki',
      speechSpeed: 0.88,
      interaction: { type: 'proximity', radius: 3.2 },
      dialogueTree: [
        {
          id: 'greeting',
          npcText: 'Welcome to the farm! What animal can you see?',
          hintExamples: ['I see a cow', 'I see chickens', 'There is a sheep'],
          candidateIntents: [
            {
              intentId: 'name_farm_animal',
              description: 'The child names a farm animal such as cow, chicken, sheep, pig, horse, or duck',
              nextNodeId: 'ask_job',
            },
          ],
          fallbackNodeId: 'ask_again',
        },
        {
          id: 'ask_again',
          npcText: "Try naming an animal. You can say, 'I see a cow.'",
          hintExamples: ['I see a cow', 'There is a chicken'],
          candidateIntents: [
            {
              intentId: 'name_farm_animal',
              description: 'The child names a farm animal such as cow, chicken, sheep, pig, horse, or duck',
              nextNodeId: 'ask_job',
            },
          ],
          fallbackNodeId: 'ask_job',
        },
        {
          id: 'ask_job',
          npcText: 'Nice! Can you help with one farm job?',
          hintExamples: ['I can get eggs', 'I can give water', 'I can drive the tractor'],
          candidateIntents: [
            {
              intentId: 'offer_farm_help',
              description: 'The child offers to help with a farm job such as getting eggs, giving water, feeding animals, or using the tractor',
              nextNodeId: 'goodbye',
            },
          ],
          fallbackNodeId: 'goodbye',
        },
        {
          id: 'goodbye',
          npcText: 'Wonderful farm helper! You earned {score} points.',
          hintExamples: [],
          candidateIntents: [],
          isTerminal: true,
        },
      ],
    },
  ],
  tasks: [
    {
      id: 'name_farm_animal',
      description: 'Name one animal on the farm.',
      trigger: { type: 'dialogue_node', npcId: 'farmer', nodeId: 'greeting' },
      targetIntent: 'name_farm_animal',
      scoreReward: 10,
      maxAttempts: 3,
    },
    {
      id: 'offer_farm_help',
      description: 'Offer to help with a farm job.',
      trigger: { type: 'dialogue_node', npcId: 'farmer', nodeId: 'ask_job' },
      targetIntent: 'offer_farm_help',
      scoreReward: 8,
    },
  ],
};
