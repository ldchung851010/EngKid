import { Hono } from 'hono';
import { getConfig } from '../config.js';
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

export function ttsRoutes(opts: TTSOptions): Hono {
  const app = new Hono();

  app.post('/tts', async (c) => {
    const body = await c.req.json();
    const parsed = parseTTSBody(body);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const { input, voice: clientVoice, speed: clientSpeed } = parsed;

    // Resolve cloud/local from opts or config (config is used in Workers where opts are empty)
    const config = getConfig();
    const glmApiKey = opts.glmApiKey || config.glmApiKey;
    const isCloud = !!glmApiKey;
    const voice = isCloud ? (opts.cloudVoice || config.ttsVoice || 'tongtong') : clientVoice;
    const speed = isCloud ? 1.0 : clientSpeed;
    const ttsBase = opts.ttsPort ? `http://localhost:${opts.ttsPort}` : null;

    if (!isCloud && !ttsBase) {
      return c.json({ error: 'TTS not available' }, 503);
    }

    const cacheKey = { input, voice, speed };
    const cached = await readCachedTTS(cacheKey);
    if (cached) {
      console.log(`[TTS] cache HIT for "${input.substring(0, 20)}..."`);
      c.header('Content-Type', 'audio/wav');
      c.header('Content-Length', String(cached.length));
      c.header('X-TTS-Cache', 'HIT');
      return c.body(cached.buffer as ArrayBuffer, 200);
    }
    console.log(`[TTS] cache MISS for "${input.substring(0, 20)}..."`);

    const clientIp = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const quota = consumeQuota('tts', clientIp);
    if (!quota.ok) {
      if (quota.retryAfterSeconds) c.header('Retry-After', String(quota.retryAfterSeconds));
      return c.json({
        error: quota.error ?? 'TTS quota exceeded',
        retryAfterSeconds: quota.retryAfterSeconds,
      }, (quota.statusCode ?? 429) as 429);
    }

    console.log(`[TTS] ← generate: "${input.substring(0, 40)}..." (${isCloud ? 'cloud' : 'local'})`);

    try {
      let wavBuffer: Uint8Array;

      if (isCloud) {
        wavBuffer = await generateCloudTTS(glmApiKey, input, voice, speed);
      } else {
        wavBuffer = await generateLocalTTS(ttsBase!, input, voice, speed);
      }

      try {
        await writeCachedTTS(cacheKey, wavBuffer);
        console.log(`[TTS] cache written for "${input.substring(0, 20)}..."`);
      } catch (cacheError) {
        console.warn('[TTS] cache write failed:', cacheError);
      }

      c.header('Content-Type', 'audio/wav');
      c.header('Content-Length', String(wavBuffer.length));
      c.header('X-TTS-Cache', 'MISS');
      return c.body(wavBuffer.buffer as ArrayBuffer, 200);
    } catch (err) {
      console.log('[TTS] ❌ error:', err);
      return c.json({ error: 'TTS upstream unavailable' }, 502);
    }
  });

  return app;
}

async function generateLocalTTS(ttsBase: string, input: string, voice: string, speed: number): Promise<Uint8Array> {
  const res = await fetch(`${ttsBase}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, voice, response_format: 'pcm', stream: false, speed }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`local TTS error ${res.status}: ${errText}`);
  }

  const pcmBuffer = new Uint8Array(await res.arrayBuffer());
  return pcmToWav(pcmBuffer, 24000, 1, 16);
}

export async function generateCloudTTS(
  apiKey: string, input: string, voice: string, speed: number,
): Promise<Uint8Array> {
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

  return new Uint8Array(await res.arrayBuffer());
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
