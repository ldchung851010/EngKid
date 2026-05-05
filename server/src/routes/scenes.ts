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
    const metaPath = path.resolve(import.meta.dirname ?? '.', '../../data/scenes-metadata.json');
    try {
      const raw = fs.readFileSync(metaPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      app.log.error(`[scenes] failed to read ${metaPath}`);
      return { scenes: [] };
    }
  });
}
