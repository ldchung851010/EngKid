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

test('unlocks every A1 scene before progress exists', () => {
  const portalScenes = applyLocalProgress(scenes, createProgressReader({}));

  assert.deepEqual(portalScenes.filter((scene) => scene.cefrLevel === 'A1').map((scene) => scene.unlocked), [true, true, true]);
  assert.deepEqual(portalScenes.filter((scene) => scene.cefrLevel === 'A2').map((scene) => scene.unlocked), [false, false]);
});

test('keeps A2 locked until all A1 scenes are complete', () => {
  const portalScenes = applyLocalProgress(scenes, createProgressReader({
    restaurant: { completed: true, score: 10 },
    school: { completed: true, score: 8 },
  }));

  assert.deepEqual(portalScenes.filter((scene) => scene.cefrLevel === 'A2').map((scene) => scene.unlocked), [false, false]);
});

test('unlocks A2 scenes after every A1 scene is complete', () => {
  const portalScenes = applyLocalProgress(scenes, createProgressReader({
    restaurant: { completed: true, score: 10 },
    school: { completed: true, score: 8 },
    zoo: { completed: true, score: 12 },
  }));

  assert.deepEqual(portalScenes.filter((scene) => scene.cefrLevel === 'A2').map((scene) => scene.unlocked), [true, true]);
});

function createScene(id: string, name: string, cefrLevel: string): SceneInfo {
  return { id, name, cefrLevel, description: '', targetVocabulary: [] };
}

function createProgressReader(progress: Record<string, { completed: boolean; score: number }>) {
  return {
    getSceneProgress: (sceneId: string) => progress[sceneId] ?? null,
  };
}
