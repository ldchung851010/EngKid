import type { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { getProgress } from './db.js';

interface SceneMeta {
  id: string;
  name: string;
  description: string;
  cefrLevel: string;
  unlocked: boolean;
  completed: boolean;
  score: number;
}

export async function scenesRoutes(app: FastifyInstance) {
  app.get('/scenes', async () => {
    const scenesDir = path.resolve(import.meta.dirname ?? '.', '../../../src/scenes');
    const dirs = fs.readdirSync(scenesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    const progressRows = getProgress();
    const progressMap = new Map(progressRows.map((r) => [r.scene_id, r]));

    const scenes: Omit<SceneMeta, 'unlocked'>[] = [];

    for (const dir of dirs) {
      try {
        const configPath = path.join(scenesDir, dir.name, 'config.ts');
        // Dynamic import to load TS config at runtime
        const mod = await import(configPath);
        const config = mod[Object.keys(mod).find((k) => k.endsWith('Config') || k === 'config') ?? ''];
        if (!config?.name) continue;

        const progress = progressMap.get(dir.name);
        scenes.push({
          id: dir.name,
          name: config.name,
          description: config.description ?? '',
          cefrLevel: config.cefrLevel ?? 'A1',
          completed: progress?.completed === 1,
          score: progress?.score ?? 0,
        });
      } catch (err) {
        console.warn(`[scenes] failed to load scene config: ${dir.name}`, String(err));
      }
    }

    // Sort by CEFR level, then unlock based on previous scene completion
    scenes.sort((a, b) => a.cefrLevel.localeCompare(b.cefrLevel) || a.name.localeCompare(b.name));

    const result: SceneMeta[] = [];
    let previousCompleted = true;

    for (const scene of scenes) {
      result.push({
        ...scene,
        unlocked: previousCompleted,
      });
      previousCompleted = scene.completed;
    }

    return { scenes: result };
  });
}
