import type { FastifyInstance } from 'fastify';
import { getProgress, upsertProgress } from './db.js';

export async function progressRoutes(app: FastifyInstance) {
  app.get('/progress', async () => {
    const rows = getProgress();
    const totalScore = rows.reduce((sum, r) => sum + r.score, 0);
    return {
      scenes: rows.map((r) => ({
        sceneId: r.scene_id,
        completed: r.completed === 1,
        score: r.score,
        lastPlayedAt: r.last_played_at,
      })),
      totalScore,
    };
  });

  app.post('/progress', async (request, reply) => {
    const body = request.body as { sceneId?: string; score?: number; completed?: boolean };

    if (!body.sceneId || typeof body.sceneId !== 'string' || body.sceneId.trim() === '') {
      return reply.status(400).send({ error: 'sceneId is required and must be a non-empty string' });
    }
    if (typeof body.score !== 'number' || body.score < 0 || !Number.isInteger(body.score)) {
      return reply.status(400).send({ error: 'score must be a non-negative integer' });
    }

    upsertProgress(body.sceneId, !!body.completed, body.score);

    const rows = getProgress();
    const totalScore = rows.reduce((sum, r) => sum + r.score, 0);
    return {
      scenes: rows.map((r) => ({
        sceneId: r.scene_id,
        completed: r.completed === 1,
        score: r.score,
        lastPlayedAt: r.last_played_at,
      })),
      totalScore,
    };
  });
}
