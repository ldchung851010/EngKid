import type { FastifyInstance } from 'fastify';

export async function asrRoutes(app: FastifyInstance) {
  app.post('/asr', async (request, reply) => {
    const start = Date.now();
    const GLM_API_KEY = process.env.GLM_API_KEY;
    if (!GLM_API_KEY) {
      console.log('[ASR] ❌ GLM_API_KEY not configured');
      return reply.status(500).send({ error: 'GLM_API_KEY not configured' });
    }

    const data = await request.file();
    if (!data) {
      console.log('[ASR] ❌ No audio file provided');
      return reply.status(400).send({ error: 'No audio file provided' });
    }

    const buffer = await data.toBuffer();
    console.log(`[ASR] ← received ${(buffer.length / 1024).toFixed(1)}KB, type=${data.mimetype}`);

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: 'audio/wav' });
    formData.append('file', blob, 'recording.wav');
    formData.append('model', 'glm-asr-2512');

    try {
      const response = await fetch(
        'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${GLM_API_KEY}` },
          body: formData,
        }
      );

      const result = await response.json();
      const elapsed = Date.now() - start;
      console.log(`[ASR] → GLM-ASR-2512: ${response.status} in ${elapsed}ms, text="${result.text ?? ''}"`);

      if (!response.ok) {
        console.log('[ASR] ❌ GLM error:', JSON.stringify(result));
        return reply.status(response.status).send(result);
      }

      return reply.send(result);
    } catch (err) {
      const elapsed = Date.now() - start;
      console.log(`[ASR] ❌ fetch failed after ${elapsed}ms:`, err);
      return reply.status(502).send({ error: 'ASR upstream unavailable' });
    }
  });
}
