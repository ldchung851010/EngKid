import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeCollectiblePlacements,
  findPlacementCandidates,
} from '../../src/engine/collectibles/CollectibleManager.ts';
import type { SceneConfig } from '../../src/engine/schema/SceneConfig.ts';

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
