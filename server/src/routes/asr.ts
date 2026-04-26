import type { FastifyInstance } from 'fastify';

export async function asrRoutes(app: FastifyInstance) {
  app.post('/asr', async (request, reply) => {
    const GLM_API_KEY = process.env.GLM_API_KEY;
    if (!GLM_API_KEY) {
      return reply.status(500).send({ error: 'GLM_API_KEY not configured' });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No audio file provided' });
    }

    const buffer = await data.toBuffer();
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: 'audio/wav' }), 'recording.wav');
    formData.append('model', 'glm-asr-2512');

    const response = await fetch(
      'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${GLM_API_KEY}` },
        body: formData,
      }
    );

    const result = await response.json();
    return reply.send(result);
  });
}
