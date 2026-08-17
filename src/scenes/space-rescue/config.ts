import type { SceneConfig } from '../../engine/schema/SceneConfig.js';
import { createGrid } from '../../engine/schema/grid-helpers.js';

const WIDTH = 18;
const HEIGHT = 3;
const DEPTH = 16;

function createWallLayer(): string[][] {
  const grid = createGrid(WIDTH, DEPTH, 'AIR');
  for (let x = 0; x < WIDTH; x++) grid[0][x] = 'WALL';
  for (let z = 0; z < DEPTH - 1; z++) {
    grid[z][0] = 'WALL';
    grid[z][WIDTH - 1] = 'WALL';
  }
  for (let x = 0; x < WIDTH; x++) {
    if (x < 7 || x > 10) grid[DEPTH - 1][x] = 'WALL';
  }
  return grid;
}

export const spaceRescueConfig: SceneConfig = {
  schemaVersion: '1.0',
  name: 'Space Rescue Lab',
  description: 'Help NOVA prepare a rocket: listen, ask questions, explain choices, and adapt the plan for the Moon.',
  cefrLevel: 'A1',
  targetVocabulary: ['mars', 'planet', 'rocket', 'battery', 'water', 'flashlight', 'jacket', 'moon'],
  start: {
    position: { x: 9, y: 2.6, z: 14 },
    lookAt: { x: 9, y: 2.2, z: 5 },
  },
  environment: {
    skyColor: 0x172554,
    fogColor: 0x172554,
    fogNear: 22,
    fogFar: 58,
  },
  collectibles: [
    { word: 'mars', position: { x: 7, y: 1.25, z: 5 } },
    { word: 'planet', position: { x: 5, y: 1.25, z: 5 } },
    { word: 'rocket', position: { x: 3.5, y: 1.1, z: 4 } },
    { word: 'battery', position: { x: 14, y: 1.1, z: 5 } },
    { word: 'water', position: { x: 5, y: 1.1, z: 10 } },
    { word: 'flashlight', position: { x: 8, y: 1.1, z: 10 } },
    { word: 'jacket', position: { x: 11, y: 1.1, z: 10 } },
    { word: 'moon', position: { x: 13.5, y: 1.25, z: 5 } },
  ],
  map: {
    width: WIDTH,
    height: HEIGHT,
    depth: DEPTH,
    layers: [
      { y: 0, grid: createGrid(WIDTH, DEPTH, 'FLOOR') },
      { y: 1, grid: createWallLayer() },
      { y: 2, grid: createWallLayer() },
    ],
  },
  npcs: [
    {
      id: 'nova',
      name: 'NOVA',
      role: 'A warm mission robot who keeps replies short and helps a child solve a space emergency by using English to think, ask, choose, and explain.',
      position: { x: 9, y: 0, z: 4 },
      appearance: 'nova_robot_01',
      voice: 'Kiki',
      speechSpeed: 0.84,
      interaction: { type: 'proximity', radius: 3.2 },
      dialogueTree: [
        {
          id: 'briefing',
          npcText: 'Emergency mission! Our rocket is going to the red planet. Which planet is the red planet?',
          hintExamples: ['Mars', 'Mars is the red planet'],
          candidateIntents: [
            {
              intentId: 'identify_mars',
              description: 'mars red planet',
              nextNodeId: 'ask_battery_question',
            },
          ],
          fallbackNodeId: 'mars_scaffold',
        },
        {
          id: 'mars_scaffold',
          npcText: 'Look at the planets. Earth is blue. Mars is red. Tell me: which planet is red?',
          hintExamples: ['Mars', 'The red planet is Mars'],
          candidateIntents: [
            {
              intentId: 'identify_mars',
              description: 'mars red planet',
              nextNodeId: 'ask_battery_question',
            },
          ],
          fallbackNodeId: 'ask_battery_question',
        },
        {
          id: 'ask_battery_question',
          npcText: 'Good! Now we have a problem. The rocket battery is missing. Ask me a question to find it.',
          hintExamples: ['Where is the battery?', 'Is it near the rocket?'],
          candidateIntents: [
            {
              intentId: 'ask_battery_location',
              description: 'where battery location near question',
              nextNodeId: 'battery_clue',
            },
          ],
          fallbackNodeId: 'question_scaffold',
        },
        {
          id: 'question_scaffold',
          npcText: 'Try starting with “Where is...” or ask “Is it near...?”',
          hintExamples: ['Where is the battery?', 'Is it near the control panel?'],
          candidateIntents: [
            {
              intentId: 'ask_battery_location',
              description: 'where battery location near question',
              nextNodeId: 'battery_clue',
            },
          ],
          fallbackNodeId: 'battery_clue',
        },
        {
          id: 'battery_clue',
          npcText: 'The battery is near something blue. Look around and think. What do you think it is near?',
          hintExamples: ['It is near the control panel', 'Is it near the blue control panel?'],
          candidateIntents: [
            {
              intentId: 'infer_control_panel',
              description: 'blue control panel battery near',
              nextNodeId: 'choose_supply_1',
            },
          ],
          fallbackNodeId: 'choose_supply_1',
        },
        {
          id: 'choose_supply_1',
          npcText: 'Battery found! We can take only three things: water, pizza, a teddy bear, a flashlight, a phone, or a jacket. What should we take first, and why?',
          hintExamples: ['We should take water because we need to drink', 'A flashlight, because it can help us see'],
          candidateIntents: [
            {
              intentId: 'reason_supply_1',
              description: 'should take because need water pizza teddy flashlight phone jacket reason',
              nextNodeId: 'choose_supply_2',
            },
          ],
          fallbackNodeId: 'supply_scaffold_1',
        },
        {
          id: 'supply_scaffold_1',
          npcText: 'Think about what the object helps us do. Start with “We should take...” and add your reason.',
          hintExamples: ['We should take water because we need to drink'],
          candidateIntents: [
            {
              intentId: 'reason_supply_1',
              description: 'should take because need water pizza teddy flashlight phone jacket reason',
              nextNodeId: 'choose_supply_2',
            },
          ],
          fallbackNodeId: 'choose_supply_2',
        },
        {
          id: 'choose_supply_2',
          npcText: 'Nice thinking. Pick a different second thing. What should we take, and why?',
          hintExamples: ['We should take a jacket because it is cold', 'We need a flashlight to see'],
          candidateIntents: [
            {
              intentId: 'reason_supply_2',
              description: 'should take because need water pizza teddy flashlight phone jacket reason',
              nextNodeId: 'choose_supply_3',
            },
          ],
          fallbackNodeId: 'choose_supply_3',
        },
        {
          id: 'choose_supply_3',
          npcText: 'One last choice. Choose our third thing and explain your reason.',
          hintExamples: ['We should take the phone because we can call for help', 'A teddy bear because it can help us feel safe'],
          candidateIntents: [
            {
              intentId: 'reason_supply_3',
              description: 'should take because need water pizza teddy flashlight phone jacket reason',
              nextNodeId: 'transfer',
            },
          ],
          fallbackNodeId: 'transfer',
        },
        {
          id: 'transfer',
          npcText: 'New message! We are going to the Moon instead of Mars. Would you take the same things? Tell me what you would keep or change, and why.',
          hintExamples: ['I would take a jacket because the Moon is cold', 'I would change the pizza for a flashlight because it is dark'],
          candidateIntents: [
            {
              intentId: 'transfer_reasoning',
              description: 'moon change same keep take because should need reason',
              nextNodeId: 'complete',
            },
          ],
          fallbackNodeId: 'transfer_scaffold',
        },
        {
          id: 'transfer_scaffold',
          npcText: 'Think about what is different on the Moon. Start with “I would...” or “We should...” and give one reason.',
          hintExamples: ['We should take a jacket because the Moon is cold'],
          candidateIntents: [
            {
              intentId: 'transfer_reasoning',
              description: 'moon change same keep take because should need reason',
              nextNodeId: 'complete',
            },
          ],
          fallbackNodeId: 'complete',
        },
        {
          id: 'complete',
          npcText: 'Mission complete! You listened, asked a question, made choices, explained your ideas, and changed your plan for a new place. Great work, astronaut!',
          hintExamples: [],
          candidateIntents: [],
          isTerminal: true,
        },
      ],
    },
  ],
  tasks: [
    {
      id: 'understand_mars',
      description: 'Identify Mars from the red-planet clue.',
      trigger: { type: 'dialogue_node', npcId: 'nova', nodeId: 'briefing' },
      targetIntent: 'identify_mars',
      scoreReward: 5,
      maxAttempts: 3,
    },
    {
      id: 'form_question',
      description: 'Ask NOVA a useful question about the missing battery.',
      trigger: { type: 'dialogue_node', npcId: 'nova', nodeId: 'ask_battery_question' },
      targetIntent: 'ask_battery_location',
      scoreReward: 10,
      maxAttempts: 3,
    },
    {
      id: 'infer_location',
      description: 'Use NOVA’s clue to infer the battery location.',
      trigger: { type: 'dialogue_node', npcId: 'nova', nodeId: 'battery_clue' },
      targetIntent: 'infer_control_panel',
      scoreReward: 5,
      maxAttempts: 2,
    },
    {
      id: 'reason_supply_1',
      description: 'Choose a useful supply and explain why.',
      trigger: { type: 'dialogue_node', npcId: 'nova', nodeId: 'choose_supply_1' },
      targetIntent: 'reason_supply_1',
      scoreReward: 10,
      maxAttempts: 3,
    },
    {
      id: 'reason_supply_2',
      description: 'Choose a second useful supply and explain why.',
      trigger: { type: 'dialogue_node', npcId: 'nova', nodeId: 'choose_supply_2' },
      targetIntent: 'reason_supply_2',
      scoreReward: 10,
      maxAttempts: 3,
    },
    {
      id: 'reason_supply_3',
      description: 'Choose a third useful supply and explain why.',
      trigger: { type: 'dialogue_node', npcId: 'nova', nodeId: 'choose_supply_3' },
      targetIntent: 'reason_supply_3',
      scoreReward: 10,
      maxAttempts: 3,
    },
    {
      id: 'transfer_reasoning',
      description: 'Adapt the plan from Mars to the Moon and explain why.',
      trigger: { type: 'dialogue_node', npcId: 'nova', nodeId: 'transfer' },
      targetIntent: 'transfer_reasoning',
      scoreReward: 20,
      maxAttempts: 3,
    },
  ],
};
