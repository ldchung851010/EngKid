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

export function applyLocalProgress(scenes: SceneInfo[], progressReader: SceneProgressReader): PortalScene[] {
  return scenes.map((scene) => {
    const progress = progressReader.getSceneProgress(scene.id);
    return {
      ...scene,
      unlocked: true,
      completed: progress?.completed ?? false,
      score: progress?.score ?? 0,
    };
  });
}
