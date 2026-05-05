import { Hono } from 'hono';
import fs from 'fs';
import path from 'path';

export function scenesRoutes(): Hono {
  const app = new Hono();

  app.get('/scenes', async (c) => {
    const metaPath = path.resolve(import.meta.dirname ?? '.', '../../data/scenes-metadata.json');
    try {
      const raw = fs.readFileSync(metaPath, 'utf-8');
      return c.json(JSON.parse(raw));
    } catch {
      console.error(`[scenes] failed to read ${metaPath}`);
      return c.json({ scenes: [] });
    }
  });

  return app;
}
