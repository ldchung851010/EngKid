import type { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';

interface SceneMeta {
  id: string;
  name: string;
  description: string;
  cefrLevel: string;
  targetVocabulary: string[];
}

export async function scenesRoutes(app: FastifyInstance) {
  app.get('/scenes', async () => {
    const scenesDir = path.resolve(import.meta.dirname ?? '.', '../../../src/scenes');
    const dirs = fs.readdirSync(scenesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    const scenes: SceneMeta[] = [];

    for (const dir of dirs) {
      try {
        const configPath = path.join(scenesDir, dir.name, 'config.ts');
        // Dynamic import to load TS config at runtime
        const mod = await import(configPath);
        const config = mod[Object.keys(mod).find((k) => k.endsWith('Config') || k === 'config') ?? ''];
        if (!config?.name) continue;

        scenes.push({
          id: dir.name,
          name: config.name,
          description: config.description ?? '',
          cefrLevel: config.cefrLevel ?? 'A1',
          targetVocabulary: Array.isArray(config.targetVocabulary) ? config.targetVocabulary : [],
        });
      } catch (err) {
        console.warn(`[scenes] failed to load scene config: ${dir.name}`, String(err));
      }
    }

    // Sort by CEFR level, then scene name. User progress lives in the browser.
    scenes.sort((a, b) => a.cefrLevel.localeCompare(b.cefrLevel) || a.name.localeCompare(b.name));

    return { scenes };
  });
}
