import type { FastifyInstance } from 'fastify';
import { pcmToWav } from '../utils/audio.js';
import { consumeQuota } from '../utils/quota.js';
import { readCachedTTS, writeCachedTTS } from '../utils/ttsCache.js';

const GLM_TTS_URL = 'https://open.bigmodel.cn/api/paas/v4/audio/speech';
const GLM_TTS_MODEL = 'glm-tts';

interface TTSOptions {
  ttsPort?: number;
  glmApiKey?: string;
  cloudVoice?: string;
}

export function ttsRoutes(opts: TTSOptions) {
  return async function (app: FastifyInstance) {
    const isCloud = !!opts.glmApiKey;
    const cloudVoice = opts.cloudVoice ?? 'tongtong';
    const ttsBase = opts.ttsPort ? `http://localhost:${opts.ttsPort}` : null;

    app.post('/tts', async (request, reply) => {
      const parsed = parseTTSBody(request.body);
      if (!parsed.ok) return reply.status(400).send({ error: parsed.error });

      const { input, voice: clientVoice, speed: clientSpeed } = parsed;
      const voice = isCloud ? cloudVoice : clientVoice;
      const speed = isCloud ? 1.0 : clientSpeed;
      const cacheKey = { input, voice, speed };
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

      console.log(`[TTS] ← generate: "${input.substring(0, 40)}..." (${isCloud ? 'cloud' : 'local'})`);

      try {
        let wavBuffer: Buffer;

        if (isCloud) {
          wavBuffer = await generateCloudTTS(opts.glmApiKey!, input, voice, speed);
        } else {
          wavBuffer = await generateLocalTTS(ttsBase!, input, voice, speed);
        }

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

async function generateLocalTTS(ttsBase: string, input: string, voice: string, speed: number): Promise<Buffer> {
  const res = await fetch(`${ttsBase}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, voice, response_format: 'pcm', stream: false, speed }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`local TTS error ${res.status}: ${errText}`);
  }

  const pcmBuffer = Buffer.from(await res.arrayBuffer());
  return pcmToWav(pcmBuffer, 24000, 1, 16);
}

export async function generateCloudTTS(
  apiKey: string, input: string, voice: string, speed: number,
): Promise<Buffer> {
  const res = await fetch(GLM_TTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GLM_TTS_MODEL,
      input,
      voice,
      speed,
      response_format: 'wav',
      "watermark_enabled": false
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GLM-TTS error ${res.status}: ${errText}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

type TTSBodyResult =
  | { ok: true; input: string; voice: string; speed: number }
  | { ok: false; error: string };

function parseTTSBody(body: unknown): TTSBodyResult {
  if (!isRecord(body)) return { ok: false, error: 'request body must be an object' };
  if (typeof body.input !== 'string') return { ok: false, error: 'input is required and must be a string' };

  const input = body.input.trim();
  if (!input) return { ok: false, error: 'input must be non-empty' };
  if (input.length > 300) return { ok: false, error: 'input is too long' };

  const voice = typeof body.voice === 'string' && body.voice.trim() ? body.voice.trim() : 'Kiki';
  if (voice.length > 40 || !/^[A-Za-z0-9_-]+$/.test(voice)) {
    return { ok: false, error: 'voice is invalid' };
  }

  const speed = body.speed === undefined ? 1.0 : Number(body.speed);
  if (!Number.isFinite(speed) || speed < 0.5 || speed > 1.5) {
    return { ok: false, error: 'speed must be between 0.5 and 1.5' };
  }

  return { ok: true, input, voice, speed: Number(speed.toFixed(2)) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
