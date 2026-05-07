import { Hono } from 'hono';
import { getConfig } from '../config.js';
import { callTextAIJson } from '../utils/aiGateway.js';
import { readJsonBody } from '../utils/requestBody.js';
import {
  EXAMPLE_PROMPT_VERSION,
  readCachedExample,
  writeCachedExample,
  type CachedExample,
} from '../utils/exampleCache.js';

interface ExampleResponse {
  sentence: string;
  explanation: string;
}

export function exampleRoutes(): Hono {
  const app = new Hono();

  app.post('/example', async (c) => {
    const bodyResult = await readJsonBody(c);
    if (!bodyResult.ok) return bodyResult.response;

    const parsed = parseExampleBody(bodyResult.body);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const { word, level } = parsed;
    const model = getConfig().deepseekModel;
    const cacheKey = { word, cefrLevel: level, model, promptVersion: EXAMPLE_PROMPT_VERSION };
    const cached = await readCachedExample(cacheKey);
    if (cached) {
      c.header('X-Example-Cache', 'HIT');
      return c.json(cached);
    }

    const prompt = `You are helping a young child (ages 6-12) learn English. For the word "${word}" (CEFR ${level}), provide: 1) one very simple English sentence using the word (maximum 8 words, use vocabulary a 6-year-old would know), 2) a short Chinese explanation suitable for a child. Return valid JSON: {"sentence": string, "explanation": string}.`;

    const clientIp = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const result = await callTextAIJson(clientIp, {
      logName: 'Example',
      prompt,
      temperature: 0.3,
      maxTokens: 512,
    });
    if (!result.ok) {
      if (result.body.retryAfterSeconds) c.header('Retry-After', String(result.body.retryAfterSeconds));
      return c.json(result.body, result.statusCode as 429 | 500 | 502);
    }

    const content = result.content as Partial<ExampleResponse>;
    if (typeof content.sentence !== 'string' || typeof content.explanation !== 'string') {
      return c.json({ error: 'Example upstream returned invalid JSON' }, 502);
    }

    const example: CachedExample = {
      sentence: content.sentence,
      explanation: content.explanation,
    };
    try {
      await writeCachedExample(cacheKey, example);
    } catch (cacheError) {
      console.warn('[Example] cache write failed:', cacheError);
    }
    c.header('X-Example-Cache', 'MISS');
    return c.json(example);
  });

  return app;
}

type ExampleBodyResult =
  | { ok: true; word: string; level: 'A1' | 'A2' }
  | { ok: false; error: string };

function parseExampleBody(body: unknown): ExampleBodyResult {
  if (!isRecord(body)) return { ok: false, error: 'request body must be an object' };
  if (typeof body.word !== 'string') return { ok: false, error: 'word is required and must be a string' };

  const word = body.word.trim().replace(/\s+/g, ' ');
  if (!word) return { ok: false, error: 'word must be non-empty' };
  if (word.length > 60) return { ok: false, error: 'word is too long' };
  if (!/^[A-Za-z][A-Za-z\s'-]*$/.test(word)) {
    return { ok: false, error: 'word may only contain English letters, spaces, apostrophes, and hyphens' };
  }

  return {
    ok: true,
    word,
    level: body.cefrLevel === 'A2' ? 'A2' : 'A1',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
