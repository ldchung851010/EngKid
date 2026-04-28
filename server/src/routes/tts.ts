import type { FastifyInstance } from 'fastify';
import { pcmToWav } from '../utils/audio.js';
import { consumeQuota } from '../utils/quota.js';
import { readCachedTTS, writeCachedTTS } from '../utils/ttsCache.js';

export function ttsRoutes(ttsPort: number) {
  return async function (app: FastifyInstance) {
    const ttsBase = `http://localhost:${ttsPort}`;

    app.post('/tts', async (request, reply) => {
      const body = request.body as { input: string; voice?: string; speed?: number };
      if (!body?.input) {
        return reply.status(400).send({ error: 'Missing "input" field' });
      }

      const voice = body.voice || 'Kiki';
      const speed = Number.isFinite(body.speed) ? Number(body.speed) : 1.0;
      const cacheKey = { input: body.input, voice, speed };
      const cached = await readCachedTTS(cacheKey);
      if (cached) {
        reply.header('Content-Type', 'audio/wav');
        reply.header('Content-Length', cached.length);
        reply.header('X-TTS-Cache', 'HIT');
        return reply.send(cached);
      }

      const quota = consumeQuota('tts', request);
      if (!quota.ok) {
        if (quota.retryAfterSeconds) reply.header('Retry-After', quota.retryAfterSeconds);
        return reply.status(quota.statusCode ?? 429).send({
          error: quota.error ?? 'TTS quota exceeded',
          retryAfterSeconds: quota.retryAfterSeconds,
        });
      }

      console.log(`[TTS] ← generate: "${body.input.substring(0, 40)}..."`);

      try {
        const res = await fetch(`${ttsBase}/v1/audio/speech`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: body.input,
            voice,
            response_format: 'pcm',
            stream: false,
            speed,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.log(`[TTS] ❌ upstream error ${res.status}: ${errText}`);
          return reply.status(502).send({ error: `TTS upstream error: ${res.status}` });
        }

        // kitten-tts-server returns raw PCM data
        const pcmBuffer = Buffer.from(await res.arrayBuffer());

        // Convert PCM to WAV header + PCM data for browser playback
        const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);
        try {
          await writeCachedTTS(cacheKey, wavBuffer);
        } catch (cacheError) {
          console.warn('[TTS] cache write failed:', cacheError);
        }

        reply.header('Content-Type', 'audio/wav');
        reply.header('Content-Length', wavBuffer.length);
        reply.header('X-TTS-Cache', 'MISS');
        return reply.send(wavBuffer);
      } catch (err) {
        console.log('[TTS] ❌ error:', err);
        return reply.status(502).send({ error: 'TTS upstream unavailable' });
      }
    });
  };
}
