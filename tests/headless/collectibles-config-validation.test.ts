import assert from 'node:assert/strict';
import test from 'node:test';
import { validateConfig } from '../../src/engine/schema/ConfigValidator.ts';
import type { SceneConfig } from '../../src/engine/schema/SceneConfig.ts';

function createValidConfig(overrides: Partial<SceneConfig> = {}): SceneConfig {
  return {
    schemaVersion: '1.0',
    name: 'Test Scene',
    description: 'A small test scene.',
    cefrLevel: 'A1',
    targetVocabulary: ['pizza'],
    map: {
      width: 3,
      height: 3,
      depth: 3,
      layers: [
        {
          y: 0,
          grid: [
            ['FLOOR', 'FLOOR', 'FLOOR'],
            ['FLOOR', 'FLOOR', 'FLOOR'],
            ['FLOOR', 'FLOOR', 'FLOOR'],
          ],
        },
      ],
    },
    npcs: [
      {
        id: 'guide',
        name: 'Guide',
        role: 'A guide.',
        position: { x: 1, y: 0, z: 1 },
        appearance: 'guide',
        voice: 'Kiki',
        speechSpeed: 0.85,
        interaction: { type: 'proximity', radius: 3 },
        dialogueTree: [
          {
            id: 'root',
            npcText: 'Hello!',
            hintExamples: [],
            candidateIntents: [],
            isTerminal: true,
          },
        ],
      },
    ],
    tasks: [],
    ...overrides,
  };
}

test('validates a config with collectible overrides', () => {
  const result = validateConfig(createValidConfig({
    collectibles: [{ word: 'pizza', position: { x: 1, y: 0, z: 2 } }],
  }));

  assert.equal(result.valid, true);
});

test('rejects an empty collectible word', () => {
  const result = validateConfig(createValidConfig({
    collectibles: [{ word: '' }],
  }));

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.path === '$/collectibles/0/word'), true);
});

test('rejects duplicate collectible words case-insensitively', () => {
  const result = validateConfig(createValidConfig({
    collectibles: [{ word: 'Pizza' }, { word: 'pizza' }],
  }));

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.keyword === 'uniqueItems'), true);
});

test('rejects non-numeric collectible position axes', () => {
  const result = validateConfig(createValidConfig({
    collectibles: [{ word: 'pizza', position: { x: 1, y: Number.NaN, z: 2 } }],
  }));

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.path === '$/collectibles/0/position/y'), true);
});
