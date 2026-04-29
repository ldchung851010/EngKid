import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeCollectiblePlacements,
  findPlacementCandidates,
} from '../../src/engine/collectibles/CollectibleManager.ts';
import type { SceneConfig } from '../../src/engine/schema/SceneConfig.ts';
import { airportConfig } from '../../src/scenes/airport/config.ts';
import { hotelConfig } from '../../src/scenes/hotel/config.ts';
import { restaurantConfig } from '../../src/scenes/restaurant/config.ts';
import { schoolConfig } from '../../src/scenes/school/config.ts';
import { zooConfig } from '../../src/scenes/zoo/config.ts';

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
  assert.equal(candidates.some((position) => Math.hypot(position.x - 0.5, position.z - 0.5) <= 3.25), false);
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
  assert.deepEqual(byWord.get('water')?.position, { x: 3.52, y: 1.68, z: 8.18 });
  assert.deepEqual(byWord.get('juice')?.position, { x: 14.45, y: 1.68, z: 8.18 });
  assert.deepEqual(byWord.get('cola')?.position, { x: 13.05, y: 1.68, z: 12.28 });
  for (const placement of placements) {
    const waiter = restaurantConfig.npcs[0].position;
    assert.ok(Math.hypot(placement.position.x - (waiter.x + 0.5), placement.position.z - (waiter.z + 0.5)) > 3.25);
  }
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

test('keeps current scene collectibles away from the home portal', () => {
  const configs = [restaurantConfig, schoolConfig, zooConfig, airportConfig, hotelConfig];

  for (const config of configs) {
    const start = config.start ?? {
      position: { x: config.map.width / 2, y: 2.6, z: config.map.depth - 2 },
      lookAt: { x: config.map.width / 2, y: 2.3, z: config.map.depth / 2 },
    };
    const portal = { x: start.position.x, z: start.position.z + 1.5 };

    for (const placement of computeCollectiblePlacements(config)) {
      const distance = Math.hypot(placement.position.x - portal.x, placement.position.z - portal.z);
      assert.ok(
        distance > 3.25,
        `${config.name} "${placement.word}" is too close to portal: ${distance.toFixed(2)}`
      );
    }
  }
});
