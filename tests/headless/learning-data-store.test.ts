import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LearningDataStore,
  LEARNING_DATA_MAX_IMPORT_BYTES,
  type LearningDataDocument,
  type StorageAdapter,
} from '../../src/engine/runtime/LearningDataStore.ts';

class MemoryStorage implements StorageAdapter {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

class FailingStorage extends MemoryStorage {
  setItem(): void {
    throw new DOMException('quota exceeded', 'QuotaExceededError');
  }
}

function createStore(storage: StorageAdapter = new MemoryStorage()): LearningDataStore {
  return new LearningDataStore(storage, 'test.learning-data');
}

test('initializes empty learning data document', () => {
  const store = createStore();
  const data = store.getData();

  assert.equal(data.version, 1);
  assert.deepEqual(data.scenes, {});
  assert.deepEqual(data.collectibles, {});
  assert.equal(store.getTotalScore(), 0);
  assert.equal(store.getPreference<boolean>('onboardingTutorialSeen'), null);
});

test('saves and reads scene progress', () => {
  const store = createStore();
  const result = store.saveSceneProgress({ sceneId: 'restaurant', score: 42, completed: true });

  assert.equal(result.ok, true);
  assert.deepEqual(store.getSceneProgress('restaurant'), {
    sceneId: 'restaurant',
    score: 42,
    completed: true,
    lastPlayedAt: store.getSceneProgress('restaurant')?.lastPlayedAt,
  });
  assert.match(store.getSceneProgress('restaurant')?.lastPlayedAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(store.getTotalScore(), 42);
});

test('stores one collectible per scene and normalized word', () => {
  const store = createStore();

  assert.equal(store.addCollectible(' Hamburger ', 'restaurant').ok, true);
  assert.equal(store.addCollectible('hamburger', 'restaurant').ok, true);
  assert.equal(store.addCollectible('hamburger', 'airport').ok, true);

  assert.deepEqual(store.getCollectibles('restaurant').map((item) => item.word), ['hamburger']);
  assert.equal(store.getCollectibles().length, 2);
});

test('exports and imports complete learning data', () => {
  const source = createStore();
  source.saveSceneProgress({ sceneId: 'restaurant', score: 12, completed: true, lastPlayedAt: '2026-04-29T00:00:00.000Z' });
  source.addCollectible('pizza', 'restaurant', '2026-04-29T00:01:00.000Z');
  source.setPreference('onboardingTutorialSeen', true);

  const target = createStore();
  const result = target.importData(source.exportData());

  assert.equal(result.ok, true);
  assert.deepEqual(target.getSceneProgress('restaurant'), {
    sceneId: 'restaurant',
    score: 12,
    completed: true,
    lastPlayedAt: '2026-04-29T00:00:00.000Z',
  });
  assert.deepEqual(target.getCollectibles('restaurant'), [
    { word: 'pizza', sceneId: 'restaurant', collectedAt: '2026-04-29T00:01:00.000Z' },
  ]);
  assert.equal(target.getPreference<boolean>('onboardingTutorialSeen'), true);
});

test('saves and reads preferences', () => {
  const store = createStore();
  const result = store.setPreference('onboardingTutorialSeen', true);

  assert.equal(result.ok, true);
  assert.equal(store.getPreference<boolean>('onboardingTutorialSeen'), true);
});

test('rejects malformed import without overwriting current data', () => {
  const store = createStore();
  store.saveSceneProgress({ sceneId: 'restaurant', score: 8, completed: false });

  const result = store.importData('{not json');

  assert.equal(result.ok, false);
  assert.equal(result.error, 'invalid_json');
  assert.equal(store.getSceneProgress('restaurant')?.score, 8);
});

test('rejects future version import without overwriting current data', () => {
  const store = createStore();
  store.saveSceneProgress({ sceneId: 'restaurant', score: 8, completed: false });
  const future: LearningDataDocument = { version: 2 as 1, scenes: {}, collectibles: {} };

  const result = store.importData(JSON.stringify(future));

  assert.equal(result.ok, false);
  assert.equal(result.error, 'unsupported_version');
  assert.equal(store.getSceneProgress('restaurant')?.score, 8);
});

test('rejects oversized import before parsing', () => {
  const store = createStore();
  store.saveSceneProgress({ sceneId: 'restaurant', score: 8, completed: false });

  const result = store.importData('x'.repeat(LEARNING_DATA_MAX_IMPORT_BYTES + 1));

  assert.equal(result.ok, false);
  assert.equal(result.error, 'too_large');
  assert.equal(store.getSceneProgress('restaurant')?.score, 8);
});

test('reset clears data while preserving a valid empty document', () => {
  const store = createStore();
  store.saveSceneProgress({ sceneId: 'restaurant', score: 8, completed: true });
  store.addCollectible('pizza', 'restaurant');
  store.setPreference('onboardingTutorialSeen', true);

  const result = store.reset();

  assert.equal(result.ok, true);
  assert.deepEqual(store.getData(), { version: 1, scenes: {}, collectibles: {}, preferences: {} });
  assert.equal(store.getPreference<boolean>('onboardingTutorialSeen'), null);
});

test('write failures are returned as storage errors', () => {
  const store = createStore(new FailingStorage());
  const result = store.saveSceneProgress({ sceneId: 'restaurant', score: 8, completed: true });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'storage_unavailable');
});
