import { getConfig } from '../config.js';
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
  const { deepseekApiKey, deepseekModel } = getConfig();
  if (!deepseekApiKey) {
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

  const body = JSON.stringify({
    model: deepseekModel,
    messages: [{ role: 'user', content: options.prompt }],
    response_format: { type: 'json_object' },
    temperature: options.temperature,
    max_tokens: options.maxTokens,
  });

  const headers = {
    Authorization: `Bearer ${deepseekApiKey}`,
    'Content-Type': 'application/json',
  };

  // Retry once on transient failure
  let lastError: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      console.log(`[${options.logName}] retrying (attempt ${attempt + 1})...`);
    }
    const result = await doFetch(options.logName, headers, body);
    if (result.ok || result.statusCode !== 502) return result;
    lastError = result.body.error;
  }

  return { ok: false, statusCode: 502, body: { error: lastError ?? `${options.logName} upstream unavailable` } };
}

async function doFetch(
  logName: string,
  headers: Record<string, string>,
  body: string,
): Promise<TextAIResult> {
  const start = Date.now();
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers,
      body,
    });

    const elapsedMs = Date.now() - start;
    const rawText = await response.text();
    if (!rawText) {
      console.log(`[${logName}] empty response body (${response.status}) in ${elapsedMs}ms`);
      return { ok: false, statusCode: 502, body: { error: `${logName} upstream unavailable` } };
    }
    let result: { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>; error?: unknown };
    try {
      result = JSON.parse(rawText);
    } catch {
      console.log(`[${logName}] non-JSON response (${response.status}) in ${elapsedMs}ms:`, rawText.substring(0, 200));
      return { ok: false, statusCode: 502, body: { error: `${logName} upstream unavailable` } };
    }
    if (!response.ok) {
      console.log(`[${logName}] upstream error (${response.status}) in ${elapsedMs}ms:`, JSON.stringify(result));
      return { ok: false, statusCode: 502, body: { error: `${logName} upstream unavailable` } };
    }

    let contentText = result.choices?.[0]?.message?.content;
    // DeepSeek reasoning models: when content is empty due to token limit,
    // the answer may be embedded in reasoning_content
    if (!contentText && result.choices?.[0]?.message?.reasoning_content) {
      const reasoning = result.choices[0].message.reasoning_content;
      // Try to extract a JSON object from the end of reasoning_content
      const jsonMatch = reasoning.match(/\{[^}]+\}\s*$/);
      if (jsonMatch) {
        contentText = jsonMatch[0];
        console.log(`[${logName}] extracted JSON from reasoning_content`);
      }
    }
    if (!contentText) {
      console.log(`[${logName}] empty content in ${elapsedMs}ms:`, JSON.stringify(result));
      return { ok: false, statusCode: 502, body: { error: `${logName} upstream unavailable` } };
    }
    const content = JSON.parse(contentText) as Record<string, unknown>;
    console.log(`[${logName}] upstream ok in ${elapsedMs}ms`);
    return { ok: true, content, elapsedMs };
  } catch (error) {
    const elapsedMs = Date.now() - start;
    console.log(`[${logName}] fetch failed after ${elapsedMs}ms:`, error);
    return { ok: false, statusCode: 502, body: { error: `${logName} upstream unavailable` } };
  }
}
