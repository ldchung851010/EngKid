import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dbDir = mkdtempSync(path.join(tmpdir(), 'scene-engine-collectibles-'));
process.env.SCENE_ENGINE_DB_PATH = path.join(dbDir, 'progress.db');

const { getCollectibles, upsertCollectible } = await import('../../server/src/routes/db.ts');

test('upsertCollectible stores and returns a collectible row', () => {
  const row = upsertCollectible('hamburger', 'restaurant');

  assert.equal(row.word, 'hamburger');
  assert.equal(row.scene_id, 'restaurant');
  assert.match(row.collected_at, /^\d{4}-\d{2}-\d{2}T/);

  const rows = getCollectibles();
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.word, 'hamburger');
});

test('getCollectibles filters by scene id', () => {
  upsertCollectible('pizza', 'restaurant');
  upsertCollectible('passport', 'airport');

  const rows = getCollectibles('restaurant');
  assert.deepEqual(new Set(rows.map((row) => row.scene_id)), new Set(['restaurant']));
  assert.equal(rows.some((row) => row.word === 'passport'), false);
});

test('upsertCollectible keeps one row per word and scene', () => {
  upsertCollectible('water', 'restaurant');
  upsertCollectible('water', 'restaurant');

  const rows = getCollectibles('restaurant').filter((row) => row.word === 'water');
  assert.equal(rows.length, 1);
});

test('getCollectibles returns an empty array for an unknown scene', () => {
  assert.deepEqual(getCollectibles('nonexistent'), []);
});
