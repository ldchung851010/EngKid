import type { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import {
  getQuotesDir,
  loadManifest,
  type QuoteManifest,
} from '../utils/quoteGenerator.js';

export function quotesRoutes() {
  return async function (app: FastifyInstance) {
    app.get('/quotes', async (_request, reply) => {
      const manifest = await loadManifest();
      if (!manifest) {
        return reply.status(503).send({ error: 'Quotes not generated yet' });
      }
      return manifest;
    });

    app.get('/quotes/:id/audio', async (request, reply) => {
      const { id } = request.params as { id: string };
      const manifest = await loadManifest();
      if (!manifest) {
        return reply.status(503).send({ error: 'Quotes not generated yet' });
      }

      const quote = manifest.quotes.find((q) => String(q.id) === id);
      if (!quote) {
        return reply.status(404).send({ error: 'Quote not found' });
      }

      const filePath = path.join(getQuotesDir(), quote.audioFile);
      try {
        const buffer = await fs.readFile(filePath);
        reply.header('Content-Type', 'audio/wav');
        reply.header('Content-Length', buffer.length);
        return reply.send(buffer);
      } catch {
        return reply.status(404).send({ error: 'Audio file not found' });
      }
    });
  };
}
