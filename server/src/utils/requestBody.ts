import type { Context } from 'hono';

type JsonBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; response: Response };

export async function readJsonBody(c: Context): Promise<JsonBodyResult> {
  try {
    return { ok: true, body: await c.req.json() };
  } catch {
    return { ok: false, response: c.json({ error: 'invalid JSON' }, 400) };
  }
}
