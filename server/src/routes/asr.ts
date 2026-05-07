import { Hono } from 'hono';
import { getConfig } from '../config.js';
import { consumeQuota } from '../utils/quota.js';

const MAX_ASR_REQUEST_BYTES = 2_500_000;
const MAX_ASR_AUDIO_BYTES = 2_000_000;
const MAX_ASR_PROMPT_LENGTH = 500;
const MAX_ASR_HOTWORDS = 12;
const MAX_ASR_HOTWORD_LENGTH = 40;
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
]);

export function asrRoutes(): Hono {
  const app = new Hono();

  app.post('/asr', async (c) => {
    const start = Date.now();
    const { glmApiKey } = getConfig();
    if (!glmApiKey) {
      console.log('[ASR] ❌ GLM_API_KEY not configured');
      return c.json({ error: 'GLM_API_KEY not configured' }, 500);
    }

    const contentLength = readContentLength(c.req.header('content-length'));
    if (contentLength !== null && contentLength > MAX_ASR_REQUEST_BYTES) {
      return c.json({ error: 'ASR request body is too large' }, 413);
    }

    let formData: FormData;
    try {
      formData = await c.req.formData();
    } catch {
      return c.json({ error: 'invalid multipart form data' }, 400);
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      console.log('[ASR] ❌ No audio file provided');
      return c.json({ error: 'No audio file provided' }, 400);
    }

    const audioMimeType = file.type || 'audio/wav';
    if (!ALLOWED_AUDIO_MIME_TYPES.has(audioMimeType)) {
      return c.json({ error: 'audio file must be WAV' }, 400);
    }
    if (file.size <= 0) {
      return c.json({ error: 'audio file must be non-empty' }, 400);
    }
    if (file.size > MAX_ASR_AUDIO_BYTES) {
      return c.json({ error: 'audio file is too large' }, 413);
    }

    const promptResult = parsePrompt(formData.get('prompt'));
    if (!promptResult.ok) return c.json({ error: promptResult.error }, 400);

    const hotwordsResult = parseHotwords(formData.getAll('hotwords'));
    if (!hotwordsResult.ok) return c.json({ error: hotwordsResult.error }, 400);

    const clientIp = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const quota = consumeQuota('asr', clientIp);
    if (!quota.ok) {
      if (quota.retryAfterSeconds) c.header('Retry-After', String(quota.retryAfterSeconds));
      return c.json({
        error: quota.error ?? 'ASR quota exceeded',
        retryAfterSeconds: quota.retryAfterSeconds,
      }, (quota.statusCode ?? 429) as 429);
    }

    const audioBuffer = new Uint8Array(await file.arrayBuffer());
    const prompt = promptResult.value;
    const hotwords = hotwordsResult.value;

    console.log(`[ASR] ← received ${(audioBuffer.length / 1024).toFixed(1)}KB, type=${audioMimeType}, hotwords=[${hotwords.join(', ')}]`);

    const upstreamForm = new FormData();
    const blob = new Blob([audioBuffer], { type: audioMimeType });
    upstreamForm.append('file', blob, 'recording.wav');
    upstreamForm.append('model', 'glm-asr-2512');
    if (prompt) {
      upstreamForm.append('prompt', prompt);
    }
    for (const hotword of hotwords) {
      upstreamForm.append('hotwords', hotword);
    }

    try {
      const response = await fetch(
        'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${glmApiKey}` },
          body: upstreamForm,
        }
      );

      const result = await response.json() as Record<string, unknown>;
      const elapsed = Date.now() - start;
      console.log(`[ASR] → GLM-ASR-2512: ${response.status} in ${elapsed}ms, text="${result.text ?? ''}"`);

      if (!response.ok) {
        console.log('[ASR] ❌ GLM error:', JSON.stringify(result));
        return c.json(result, response.status as 200 | 400 | 401 | 403 | 404 | 500 | 502);
      }

      return c.json(result);
    } catch (err) {
      const elapsed = Date.now() - start;
      console.log(`[ASR] ❌ fetch failed after ${elapsed}ms:`, err);
      return c.json({ error: 'ASR upstream unavailable' }, 502);
    }
  });

  return app;
}

function readContentLength(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

type PromptResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

function parsePrompt(value: FormDataEntryValue | null): PromptResult {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, error: 'prompt must be a string' };

  const prompt = value.trim();
  if (!prompt) return { ok: true, value: null };
  if (prompt.length > MAX_ASR_PROMPT_LENGTH) return { ok: false, error: 'prompt is too long' };
  return { ok: true, value: prompt };
}

type HotwordsResult =
  | { ok: true; value: string[] }
  | { ok: false; error: string };

function parseHotwords(values: FormDataEntryValue[]): HotwordsResult {
  if (values.length > MAX_ASR_HOTWORDS) {
    return { ok: false, error: 'too many hotwords' };
  }

  const hotwords: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') return { ok: false, error: 'hotwords must be strings' };
    const hotword = value.trim().replace(/\s+/g, ' ');
    if (!hotword) continue;
    if (hotword.length > MAX_ASR_HOTWORD_LENGTH) return { ok: false, error: 'hotword is too long' };
    if (!/^[A-Za-z][A-Za-z\s'-]*$/.test(hotword)) {
      return { ok: false, error: 'hotword may only contain English letters, spaces, apostrophes, and hyphens' };
    }
    hotwords.push(hotword);
  }

  return { ok: true, value: hotwords };
}
