import { Hono } from 'hono';
import type { QuoteManifest } from '../utils/quoteGenerator.js';

export function quotesRoutes(manifest?: QuoteManifest): Hono {
  const app = new Hono();

  app.get('/quotes', async (c) => {
    const data = manifest ?? await loadManifestFromFs();
    if (!data) {
      return c.json({ error: 'Quotes not generated yet' }, 503);
    }
    return c.json(data);
  });

  app.get('/quotes/:id/audio', async (c) => {
    const id = c.req.param('id');
    const data = manifest ?? await loadManifestFromFs();
    if (!data) {
      return c.json({ error: 'Quotes not generated yet' }, 503);
    }

    const quote = data.quotes.find((q) => String(q.id) === id);
    if (!quote) {
      return c.json({ error: 'Quote not found' }, 404);
    }

    // Read audio from filesystem (Node.js only)
    try {
      const { default: fs } = await import('fs/promises');
      const { default: path } = await import('path');
      const { getQuotesDir } = await import('../utils/quoteGenerator.js');
      const filePath = path.join(getQuotesDir(), quote.audioFile);
      const buffer = await fs.readFile(filePath);
      c.header('Content-Type', 'audio/wav');
      c.header('Content-Length', String(buffer.length));
      return c.body(new Uint8Array(buffer).buffer as ArrayBuffer, 200);
    } catch {
      return c.json({ error: 'Audio file not found' }, 404);
    }
  });

  return app;
}

async function loadManifestFromFs(): Promise<QuoteManifest | null> {
  try {
    const { loadManifest } = await import('../utils/quoteGenerator.js');
    return await loadManifest();
  } catch {
    return null;
  }
}
