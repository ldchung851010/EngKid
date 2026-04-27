import assert from 'node:assert/strict';
import test from 'node:test';
import {
  doesTranscriptMatchWord,
  getActiveCollectible,
  isInRange,
} from '../../src/engine/collectibles/CollectibleManager.ts';

const items = [
  { word: 'pizza', position: { x: 1, y: 0, z: 0 } },
  { word: 'water', position: { x: 1.5, y: 0, z: 0 } },
  { word: 'book', position: { x: 0.5, y: 0, z: 0 }, collected: true },
];

test('isInRange uses horizontal distance', () => {
  assert.equal(isInRange({ x: 0, y: 10, z: 0 }, { x: 1, y: 0, z: 1 }, 2), true);
  assert.equal(isInRange({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, 2), false);
});

test('getActiveCollectible returns the nearest uncollected item', () => {
  const active = getActiveCollectible(items, { x: 0, y: 0, z: 0 }, 2);

  assert.equal(active?.word, 'pizza');
});

test('getActiveCollectible skips collected items', () => {
  const active = getActiveCollectible(items, { x: 0.4, y: 0, z: 0 }, 2);

  assert.equal(active?.word, 'pizza');
});

test('getActiveCollectible keeps first item on exact distance ties', () => {
  const active = getActiveCollectible([
    { word: 'first', position: { x: 1, y: 0, z: 0 } },
    { word: 'second', position: { x: -1, y: 0, z: 0 } },
  ], { x: 0, y: 0, z: 0 }, 2);

  assert.equal(active?.word, 'first');
});

test('getActiveCollectible returns null when no item is in range', () => {
  assert.equal(getActiveCollectible(items, { x: 10, y: 0, z: 0 }, 2), null);
});

test('doesTranscriptMatchWord requires the spoken word to match', () => {
  assert.equal(doesTranscriptMatchWord('Pizza.', 'pizza'), true);
  assert.equal(doesTranscriptMatchWord('thank you', 'thank you'), true);
  assert.equal(doesTranscriptMatchWord('a pizza', 'pizza'), false);
  assert.equal(doesTranscriptMatchWord('water', 'pizza'), false);
});
