import { Hono } from 'hono';
import fs from 'fs/promises';
import path from 'path';
import {
  getQuotesDir,
  loadManifest,
} from '../utils/quoteGenerator.js';

export function quotesRoutes(): Hono {
  const app = new Hono();

  app.get('/quotes', async (c) => {
    const manifest = await loadManifest();
    if (!manifest) {
      return c.json({ error: 'Quotes not generated yet' }, 503);
    }
    return c.json(manifest);
  });

  app.get('/quotes/:id/audio', async (c) => {
    const id = c.req.param('id');
    const manifest = await loadManifest();
    if (!manifest) {
      return c.json({ error: 'Quotes not generated yet' }, 503);
    }

    const quote = manifest.quotes.find((q) => String(q.id) === id);
    if (!quote) {
      return c.json({ error: 'Quote not found' }, 404);
    }

    const filePath = path.join(getQuotesDir(), quote.audioFile);
    try {
      const buffer = await fs.readFile(filePath);
      c.header('Content-Type', 'audio/wav');
      c.header('Content-Length', String(buffer.length));
      return c.body(new Uint8Array(buffer));
    } catch {
      return c.json({ error: 'Audio file not found' }, 404);
    }
  });

  return app;
}
