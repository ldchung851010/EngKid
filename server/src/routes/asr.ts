import type { FastifyInstance } from 'fastify';
import { consumeQuota } from '../utils/quota.js';

export async function asrRoutes(app: FastifyInstance) {
  app.post('/asr', async (request, reply) => {
    const start = Date.now();
    const GLM_API_KEY = process.env.GLM_API_KEY;
    if (!GLM_API_KEY) {
      console.log('[ASR] ❌ GLM_API_KEY not configured');
      return reply.status(500).send({ error: 'GLM_API_KEY not configured' });
    }

    const quota = consumeQuota('asr', request);
    if (!quota.ok) {
      if (quota.retryAfterSeconds) reply.header('Retry-After', quota.retryAfterSeconds);
      return reply.status(quota.statusCode ?? 429).send({
        error: quota.error ?? 'ASR quota exceeded',
        retryAfterSeconds: quota.retryAfterSeconds,
      });
    }

    let audioBuffer: Buffer | null = null;
    let audioMimeType = 'audio/wav';
    let prompt: string | null = null;
    const hotwords: string[] = [];

    for await (const part of request.parts()) {
      if (part.type === 'file' && part.fieldname === 'file') {
        audioBuffer = await part.toBuffer();
        audioMimeType = part.mimetype || audioMimeType;
      } else if (part.type === 'field' && part.fieldname === 'prompt' && typeof part.value === 'string') {
        prompt = part.value;
      } else if (part.type === 'field' && part.fieldname === 'hotwords') {
        hotwords.push(...parseHotwords(part.value));
      }
    }

    if (!audioBuffer) {
      console.log('[ASR] ❌ No audio file provided');
      return reply.status(400).send({ error: 'No audio file provided' });
    }

    console.log(`[ASR] ← received ${(audioBuffer.length / 1024).toFixed(1)}KB, type=${audioMimeType}, hotwords=[${hotwords.join(', ')}]`);

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: audioMimeType });
    formData.append('file', blob, 'recording.wav');
    formData.append('model', 'glm-asr-2512');
    if (prompt) {
      formData.append('prompt', prompt);
    }
    for (const hotword of hotwords) {
      formData.append('hotwords', hotword);
    }

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

function parseHotwords(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
  } catch {
    // Plain form field; keep going.
  }

  return [trimmed];
}
