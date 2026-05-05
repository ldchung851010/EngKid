import { Hono } from 'hono';
import { getAllQuotaStatus } from '../utils/quota.js';

export function quotaRoutes(): Hono {
  const app = new Hono();

  app.get('/quota', async (c) => {
    const clientIp = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    return c.json(getAllQuotaStatus(clientIp));
  });

  return app;
}
