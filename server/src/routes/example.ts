import type { FastifyInstance } from 'fastify';
import { callTextAIJson } from '../utils/aiGateway.js';

interface ExampleResponse {
  sentence: string;
  explanation: string;
}

export async function exampleRoutes(app: FastifyInstance) {
  app.post('/example', async (request, reply) => {
    const body = request.body as { word?: string; cefrLevel?: 'A1' | 'A2' };
    if (!body.word || typeof body.word !== 'string' || body.word.trim() === '') {
      return reply.status(400).send({ error: 'word is required and must be a non-empty string' });
    }

    const word = body.word.trim();
    const level = body.cefrLevel === 'A2' ? 'A2' : 'A1';
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

    return {
      sentence: content.sentence,
      explanation: content.explanation,
    };
  });
}
