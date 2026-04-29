export interface SceneInfo {
  id: string;
  name: string;
  description: string;
  cefrLevel: string;
  targetVocabulary: string[];
}

export interface PortalScene extends SceneInfo {
  unlocked: boolean;
  completed: boolean;
  score: number;
}

export interface SceneProgressReader {
  getSceneProgress(sceneId: string): { completed: boolean; score: number } | null;
}

const CEFR_LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function applyLocalProgress(scenes: SceneInfo[], progressReader: SceneProgressReader): PortalScene[] {
  const completedByScene = new Map<string, boolean>();
  for (const scene of scenes) {
    completedByScene.set(scene.id, progressReader.getSceneProgress(scene.id)?.completed ?? false);
  }

  const levels = [...new Set(scenes.map((scene) => scene.cefrLevel))].sort(compareCefrLevels);
  const unlockedByLevel = new Map<string, boolean>();
  let lowerLevelsComplete = true;

  for (const level of levels) {
    const levelScenes = scenes.filter((scene) => scene.cefrLevel === level);
    unlockedByLevel.set(level, lowerLevelsComplete);
    lowerLevelsComplete = lowerLevelsComplete && levelScenes.every((scene) => completedByScene.get(scene.id) === true);
  }

  return scenes.map((scene) => {
    const progress = progressReader.getSceneProgress(scene.id);
    return {
      ...scene,
      unlocked: unlockedByLevel.get(scene.cefrLevel) ?? false,
      completed: progress?.completed ?? false,
      score: progress?.score ?? 0,
    };
  });
}

function compareCefrLevels(a: string, b: string): number {
  const aIndex = CEFR_LEVEL_ORDER.indexOf(a);
  const bIndex = CEFR_LEVEL_ORDER.indexOf(b);
  if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
  if (aIndex !== -1) return -1;
  if (bIndex !== -1) return 1;
  return a.localeCompare(b);
}
