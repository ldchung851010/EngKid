import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeCollectiblePlacements,
  findPlacementCandidates,
} from '../../src/engine/collectibles/CollectibleManager.ts';
import type { SceneConfig } from '../../src/engine/schema/SceneConfig.ts';
import { airportConfig } from '../../src/scenes/airport/config.ts';
import { restaurantConfig } from '../../src/scenes/restaurant/config.ts';

function createConfig(overrides: Partial<SceneConfig> = {}): SceneConfig {
  return {
    schemaVersion: '1.0',
    name: 'Placement Test',
    description: 'Placement Test',
    cefrLevel: 'A1',
    targetVocabulary: ['pizza', 'water', 'book'],
    map: {
      width: 5,
      height: 3,
      depth: 5,
      layers: [
        {
          y: 0,
          grid: [
            ['FLOOR', 'FLOOR', 'FLOOR', 'FLOOR', 'FLOOR'],
            ['FLOOR', 'FLOOR', 'FLOOR', 'FLOOR', 'FLOOR'],
            ['FLOOR', 'FLOOR', 'FLOOR', 'FLOOR', 'FLOOR'],
            ['FLOOR', 'FLOOR', 'FLOOR', 'FLOOR', 'FLOOR'],
            ['FLOOR', 'FLOOR', 'FLOOR', 'FLOOR', 'FLOOR'],
          ],
        },
        {
          y: 1,
          grid: [
            ['AIR', 'AIR', 'AIR', 'AIR', 'AIR'],
            ['AIR', 'AIR', 'AIR', 'AIR', 'AIR'],
            ['AIR', 'AIR', 'WALL', 'AIR', 'AIR'],
            ['AIR', 'AIR', 'AIR', 'AIR', 'AIR'],
            ['AIR', 'AIR', 'AIR', 'AIR', 'AIR'],
          ],
        },
      ],
    },
    npcs: [
      {
        id: 'guide',
        name: 'Guide',
        role: 'Guide',
        position: { x: 0, y: 0, z: 0 },
        appearance: 'guide',
        voice: 'Kiki',
        speechSpeed: 0.85,
        interaction: { type: 'proximity', radius: 3 },
        dialogueTree: [{ id: 'root', npcText: 'Hi', hintExamples: [], candidateIntents: [], isTerminal: true }],
      },
    ],
    tasks: [],
    ...overrides,
  };
}

test('computes one valid placement per target vocabulary word', () => {
  const config = createConfig();
  const placements = computeCollectiblePlacements(config);

  assert.equal(placements.length, config.targetVocabulary.length);
  for (const placement of placements) {
    assert.ok(placement.position.x >= 0 && placement.position.x <= config.map.width);
    assert.ok(placement.position.z >= 0 && placement.position.z <= config.map.depth);
  }
});

test('excludes blocked cells and cells too close to NPC spawn', () => {
  const config = createConfig();
  const candidates = findPlacementCandidates(config.map, config.npcs.map((npc) => npc.position));

  assert.equal(candidates.some((position) => position.x === 2.5 && position.z === 2.5), false);
  assert.equal(candidates.some((position) => Math.hypot(position.x - 0.5, position.z - 0.5) <= 2), false);
});

test('uses explicit collectible override positions first', () => {
  const config = createConfig({
    collectibles: [{ word: 'pizza', position: { x: 4.5, y: 0.75, z: 4.5 } }],
  });
  const placements = computeCollectiblePlacements(config);

  assert.deepEqual(placements.find((item) => item.word === 'pizza')?.position, { x: 4.5, y: 0.75, z: 4.5 });
});

test('returns empty placements for empty vocabulary', () => {
  assert.deepEqual(computeCollectiblePlacements(createConfig({ targetVocabulary: [] })), []);
});

test('places restaurant food and drinks on scene props instead of floor scatter', () => {
  const placements = computeCollectiblePlacements(restaurantConfig);
  const byWord = new Map(placements.map((placement) => [placement.word, placement]));

  assert.deepEqual(byWord.get('pizza')?.position, { x: 14, y: 1.68, z: 8.5 });
  assert.deepEqual(byWord.get('hamburger')?.position, { x: 4, y: 1.68, z: 8.5 });
  assert.equal(byWord.get('water')?.position.y, 1.96);
  assert.equal(byWord.get('juice')?.position.y, 1.96);
});

test('places airport documents on counters and travel objects near matching props', () => {
  const placements = computeCollectiblePlacements(airportConfig);
  const byWord = new Map(placements.map((placement) => [placement.word, placement]));

  assert.equal(byWord.get('ticket')?.position.y, 2.1);
  assert.equal(byWord.get('passport')?.position.y, 2.1);
  assert.equal(byWord.get('boarding pass')?.position.y, 2.1);
  assert.equal(byWord.get('bag')?.position.y, 2.05);
  assert.ok((byWord.get('gate')?.position.x ?? 0) > 19);
});
