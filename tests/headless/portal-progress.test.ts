import assert from 'node:assert/strict';
import test from 'node:test';
import { applyLocalProgress, type SceneInfo } from '../../src/portal/portal-progress.ts';

const scenes: SceneInfo[] = [
  createScene('restaurant', 'Restaurant', 'A1'),
  createScene('school', 'School', 'A1'),
  createScene('zoo', 'Zoo', 'A1'),
  createScene('airport', 'Airport', 'A2'),
  createScene('hotel', 'Hotel', 'A2'),
];

test('unlocks all scenes regardless of level', () => {
  const portalScenes = applyLocalProgress(scenes, createProgressReader({}));

  assert.deepEqual(portalScenes.map((scene) => scene.unlocked), [true, true, true, true, true]);
});

test('tracks completed state and score per scene', () => {
  const portalScenes = applyLocalProgress(scenes, createProgressReader({
    restaurant: { completed: true, score: 10 },
    school: { completed: true, score: 8 },
  }));

  assert.equal(portalScenes[0].completed, true);
  assert.equal(portalScenes[0].score, 10);
  assert.equal(portalScenes[1].completed, true);
  assert.equal(portalScenes[1].score, 8);
  assert.equal(portalScenes[2].completed, false);
  assert.equal(portalScenes[2].score, 0);
});

function createScene(id: string, name: string, cefrLevel: string): SceneInfo {
  return { id, name, cefrLevel, description: '', targetVocabulary: [] };
}

function createProgressReader(progress: Record<string, { completed: boolean; score: number }>) {
  return {
    getSceneProgress: (sceneId: string) => progress[sceneId] ?? null,
  };
}
