import { Hono } from 'hono';
import { getConfig } from '../config.js';
import { consumeQuota } from '../utils/quota.js';

export function asrRoutes(): Hono {
  const app = new Hono();

  app.post('/asr', async (c) => {
    const start = Date.now();
    const { glmApiKey } = getConfig();
    if (!glmApiKey) {
      console.log('[ASR] ❌ GLM_API_KEY not configured');
      return c.json({ error: 'GLM_API_KEY not configured' }, 500);
    }

    const clientIp = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const quota = consumeQuota('asr', clientIp);
    if (!quota.ok) {
      if (quota.retryAfterSeconds) c.header('Retry-After', String(quota.retryAfterSeconds));
      return c.json({
        error: quota.error ?? 'ASR quota exceeded',
        retryAfterSeconds: quota.retryAfterSeconds,
      }, (quota.statusCode ?? 429) as 429);
    }

    const formData = await c.req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      console.log('[ASR] ❌ No audio file provided');
      return c.json({ error: 'No audio file provided' }, 400);
    }

    const audioBuffer = new Uint8Array(await file.arrayBuffer());
    const audioMimeType = file.type || 'audio/wav';
    const prompt = formData.get('prompt');
    const hotwords = formData.getAll('hotwords').filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

    console.log(`[ASR] ← received ${(audioBuffer.length / 1024).toFixed(1)}KB, type=${audioMimeType}, hotwords=[${hotwords.join(', ')}]`);

    const upstreamForm = new FormData();
    const blob = new Blob([audioBuffer], { type: audioMimeType });
    upstreamForm.append('file', blob, 'recording.wav');
    upstreamForm.append('model', 'glm-asr-2512');
    if (typeof prompt === 'string' && prompt.trim()) {
      upstreamForm.append('prompt', prompt.trim());
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
