import type { FastifyInstance } from 'fastify';
import { getAllQuotaStatus } from '../utils/quota.js';

export async function quotaRoutes(app: FastifyInstance) {
  app.get('/quota', async (request) => getAllQuotaStatus(request));
}
