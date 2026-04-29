import type { FastifyInstance } from 'fastify';
import { callTextAIJson } from '../utils/aiGateway.js';
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

export async function exampleRoutes(app: FastifyInstance) {
  app.post('/example', async (request, reply) => {
    const parsed = parseExampleBody(request.body);
    if (!parsed.ok) return reply.status(400).send({ error: parsed.error });

    const { word, level } = parsed;
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
    const cacheKey = { word, cefrLevel: level, model, promptVersion: EXAMPLE_PROMPT_VERSION };
    const cached = await readCachedExample(cacheKey);
    if (cached) {
      reply.header('X-Example-Cache', 'HIT');
      return cached;
    }

    const prompt = `You are helping a young child (ages 6-12) learn English. For the word "${word}" (CEFR ${level}), provide: 1) one very simple English sentence using the word (maximum 8 words, use vocabulary a 6-year-old would know), 2) a short Chinese explanation suitable for a child. Return valid JSON: {"sentence": string, "explanation": string}.`;

    const result = await callTextAIJson(request, {
      logName: 'Example',
      prompt,
      temperature: 0.3,
      maxTokens: 150,
    });
    if (!result.ok) {
      if (result.body.retryAfterSeconds) reply.header('Retry-After', result.body.retryAfterSeconds);
      return reply.status(result.statusCode).send(result.body);
    }

    const content = result.content as Partial<ExampleResponse>;
    if (typeof content.sentence !== 'string' || typeof content.explanation !== 'string') {
      return reply.status(502).send({ error: 'Example upstream returned invalid JSON' });
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
    reply.header('X-Example-Cache', 'MISS');
    return example;
  });
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
