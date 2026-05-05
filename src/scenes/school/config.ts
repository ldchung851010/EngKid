import type { SceneConfig } from '../../engine/schema/SceneConfig.js';
import { createGrid } from '../../engine/schema/grid-helpers.js';

const WIDTH = 20;
const HEIGHT = 6;
const DEPTH = 16;

function walls(): string[][] {
  const grid = createGrid(WIDTH, DEPTH, 'AIR');
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

export const schoolConfig: SceneConfig = {
  schemaVersion: '1.0',
  name: 'School',
  description: 'Practice classroom English with a teacher and ask about school supplies.',
  cefrLevel: 'A1',
  targetVocabulary: ['teacher', 'book', 'pencil', 'desk', 'chair', 'please', 'classroom'],
  start: {
    position: { x: 10, y: 2.7, z: 14 },
    lookAt: { x: 10, y: 2.3, z: 4 },
  },
  environment: {
    skyColor: 0xd7f3ff,
    fogColor: 0xd7f3ff,
    fogNear: 22,
    fogFar: 62,
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
      id: 'teacher',
      name: 'Ms. Green',
      role: 'A warm classroom teacher who helps children ask for school supplies and answer simple class questions.',
      position: { x: 10, y: 0, z: 3 },
      appearance: 'teacher_female_01',
      voice: 'Kiki',
      speechSpeed: 0.86,
      interaction: { type: 'proximity', radius: 3 },
      dialogueTree: [
        {
          id: 'greeting',
          npcText: 'Good morning! Welcome to class. What do you need for today?',
          hintExamples: ['I need a pencil', 'Can I have a book, please?', 'I need a chair'],
          candidateIntents: [
            {
              intentId: 'ask_supply',
              description: 'The child asks for a classroom item such as a book, pencil, desk, or chair',
              nextNodeId: 'class_question',
            },
          ],
          fallbackNodeId: 'ask_again',
        },
        {
          id: 'ask_again',
          npcText: "You can ask for a classroom item. Try, 'Can I have a pencil, please?'",
          hintExamples: ['Can I have a pencil, please?', 'I need a book'],
          candidateIntents: [
            {
              intentId: 'ask_supply',
              description: 'The child asks for a classroom item such as a book, pencil, desk, or chair',
              nextNodeId: 'class_question',
            },
          ],
          fallbackNodeId: 'class_question',
        },
        {
          id: 'class_question',
          npcText: 'Here you are. Now, can you say what this room is?',
          hintExamples: ['This is a classroom', 'It is a classroom', 'This is my class'],
          candidateIntents: [
            {
              intentId: 'name_classroom',
              description: 'The child says this place is a classroom or class',
              nextNodeId: 'goodbye',
            },
          ],
          fallbackNodeId: 'goodbye',
        },
        {
          id: 'goodbye',
          npcText: 'Excellent classroom English! You earned {score} points.',
          hintExamples: [],
          candidateIntents: [],
          isTerminal: true,
        },
      ],
    },
  ],
  tasks: [
    {
      id: 'ask_supply',
      description: 'Ask the teacher for a school supply.',
      trigger: { type: 'dialogue_node', npcId: 'teacher', nodeId: 'greeting' },
      targetIntent: 'ask_supply',
      scoreReward: 10,
      maxAttempts: 3,
    },
    {
      id: 'name_classroom',
      description: 'Say the name of the classroom.',
      trigger: { type: 'dialogue_node', npcId: 'teacher', nodeId: 'class_question' },
      targetIntent: 'name_classroom',
      scoreReward: 8,
    },
  ],
};
