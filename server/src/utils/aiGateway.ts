import { consumeQuota } from './quota.js';

export interface TextAIOptions {
  logName: string;
  prompt: string;
  temperature: number;
  maxTokens: number;
}

export type TextAIResult =
  | { ok: true; content: Record<string, unknown>; elapsedMs: number }
  | { ok: false; statusCode: number; body: { error: string; retryAfterSeconds?: number } };

export async function callTextAIJson(clientIp: string, options: TextAIOptions): Promise<TextAIResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.log(`[${options.logName}] DEEPSEEK_API_KEY not configured`);
    return { ok: false, statusCode: 500, body: { error: 'DEEPSEEK_API_KEY not configured' } };
  }

  const quota = consumeQuota('ai', clientIp);
  if (!quota.ok) {
    return {
      ok: false,
      statusCode: quota.statusCode ?? 429,
      body: { error: quota.error ?? 'AI quota exceeded', retryAfterSeconds: quota.retryAfterSeconds },
    };
  }

  const start = Date.now();
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
        messages: [{ role: 'user', content: options.prompt }],
        response_format: { type: 'json_object' },
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }),
    });

    const elapsedMs = Date.now() - start;
    const result = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: unknown };
    if (!response.ok) {
      console.log(`[${options.logName}] upstream error (${response.status}) in ${elapsedMs}ms:`, JSON.stringify(result));
      return { ok: false, statusCode: 502, body: { error: `${options.logName} upstream unavailable` } };
    }

    const contentText = result.choices?.[0]?.message?.content ?? '{}';
    const content = JSON.parse(contentText) as Record<string, unknown>;
    console.log(`[${options.logName}] upstream ok in ${elapsedMs}ms`);
    return { ok: true, content, elapsedMs };
  } catch (error) {
    const elapsedMs = Date.now() - start;
    console.log(`[${options.logName}] fetch failed after ${elapsedMs}ms:`, error);
    return { ok: false, statusCode: 502, body: { error: `${options.logName} upstream unavailable` } };
  }
}
