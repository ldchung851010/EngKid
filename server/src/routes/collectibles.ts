import type { FastifyInstance } from 'fastify';
import { getCollectibles, upsertCollectible } from './db.js';

export async function collectiblesRoutes(app: FastifyInstance) {
  app.get('/collectibles', async (request) => {
    const query = request.query as { sceneId?: string };
    const rows = getCollectibles(query.sceneId);
    return {
      items: rows.map((r) => ({
        word: r.word,
        sceneId: r.scene_id,
        collectedAt: r.collected_at,
      })),
    };
  });

  app.post('/collectibles', async (request, reply) => {
    const body = request.body as { word?: string; sceneId?: string };

    if (!body.word || typeof body.word !== 'string' || body.word.trim() === '') {
      return reply.status(400).send({ error: 'word is required and must be a non-empty string' });
    }
    if (!body.sceneId || typeof body.sceneId !== 'string' || body.sceneId.trim() === '') {
      return reply.status(400).send({ error: 'sceneId is required and must be a non-empty string' });
    }

    const row = upsertCollectible(body.word.trim().toLowerCase(), body.sceneId.trim());
    return {
      item: {
        word: row.word,
        sceneId: row.scene_id,
        collectedAt: row.collected_at,
      },
    };
  });
}
