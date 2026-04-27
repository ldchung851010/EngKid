import type { FastifyInstance } from 'fastify';

interface ExampleResponse {
  sentence: string;
  explanation: string;
}

export async function exampleRoutes(app: FastifyInstance) {
  app.post('/example', async (request, reply) => {
    const start = Date.now();
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    if (!DEEPSEEK_API_KEY) {
      console.log('[Example] DEEPSEEK_API_KEY not configured');
      return reply.status(500).send({ error: 'DEEPSEEK_API_KEY not configured' });
    }

    const body = request.body as { word?: string; cefrLevel?: 'A1' | 'A2' };
    if (!body.word || typeof body.word !== 'string' || body.word.trim() === '') {
      return reply.status(400).send({ error: 'word is required and must be a non-empty string' });
    }

    const word = body.word.trim();
    const level = body.cefrLevel === 'A2' ? 'A2' : 'A1';
    const prompt = `You are helping a young child (ages 6-12) learn English. For the word "${word}" (CEFR ${level}), provide: 1) one very simple English sentence using the word (maximum 8 words, use vocabulary a 6-year-old would know), 2) a short Chinese explanation suitable for a child. Return valid JSON: {"sentence": string, "explanation": string}.`;

    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 150,
        }),
      });

      const result = await response.json();
      const elapsed = Date.now() - start;
      if (!response.ok) {
        console.log(`[Example] DeepSeek error (${response.status}) in ${elapsed}ms:`, JSON.stringify(result));
        return reply.status(502).send({ error: 'Example upstream unavailable' });
      }

      const content = JSON.parse(result.choices?.[0]?.message?.content ?? '{}') as Partial<ExampleResponse>;
      if (typeof content.sentence !== 'string' || typeof content.explanation !== 'string') {
        return reply.status(502).send({ error: 'Example upstream returned invalid JSON' });
      }

      return {
        sentence: content.sentence,
        explanation: content.explanation,
      };
    } catch (error) {
      const elapsed = Date.now() - start;
      console.log(`[Example] fetch failed after ${elapsed}ms:`, error);
      return reply.status(502).send({ error: 'Example upstream unavailable' });
    }
  });
}
