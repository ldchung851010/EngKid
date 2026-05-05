import { Hono } from 'hono';

interface ScenesData {
  scenes: unknown[];
}

export function scenesRoutes(data?: ScenesData): Hono {
  const app = new Hono();

  app.get('/scenes', (c) => {
    if (data) {
      return c.json(data);
    }
    return c.json({ scenes: [] });
  });

  return app;
}
