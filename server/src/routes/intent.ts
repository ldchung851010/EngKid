import { Hono } from 'hono';
import { callTextAIJson } from '../utils/aiGateway.js';

export function intentRoutes(): Hono {
  const app = new Hono();

  app.post('/intent', async (c) => {
    const body = await c.req.json();
    const parsed = parseIntentBody(body);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const value = parsed.value;
    console.log(`[Intent] ← candidates=[${value.candidateIntents.map(c => c.intentId).join(',')}]`);

    const npcText = value.npcContext.npcText ? `\nNPC just said: "${value.npcContext.npcText}"` : '';
    const hints = value.npcContext.hintExamples?.length
      ? `\nExpected response examples:\n${value.npcContext.hintExamples.map((h: string) => `- "${h}"`).join('\n')}`
      : '';

    const prompt = `You are an intent router for a children's English learning game.

NPC: ${value.npcContext.name} (${value.npcContext.role})${npcText}

The child said: "${value.transcript}"${hints}

Candidate intents:
${value.candidateIntents.map((i) => `- ${i.intentId}: ${i.description}`).join('\n')}

Conversation history:
${value.conversationHistory.map((m) => `- ${m.role}: ${m.text}`).join('\n')}

Rules:
1. Match the child's utterance to the BEST matching intent
2. If no intent matches at all, return "none"
3. Children may mispronounce words, use ungrammatical sentences, or say things very differently from the examples — focus on INTENT, not exact wording
4. When the child's response clearly aligns with one of the expected response examples, match the corresponding intent — do NOT return "none"
5. "No", "no thanks", "no thank you", "that's all" are decline/done responses, not "no match"
6. Short one-word answers ("yes", "no", "sure", "okay") should be matched if they fit any candidate intent

Return ONLY a JSON object: {"intentId": "<id or 'none'>", "confidence": <0.0-1.0>}`;

    const clientIp = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const result = await callTextAIJson(clientIp, {
      logName: 'Intent',
      prompt,
      temperature: 0.1,
      maxTokens: 1024,
    });
    if (!result.ok) {
      if (result.body.retryAfterSeconds) c.header('Retry-After', String(result.body.retryAfterSeconds));
      return c.json(result.body, result.statusCode as 429 | 500 | 502);
    }
    return c.json({
      intentId: typeof result.content.intentId === 'string' ? result.content.intentId : 'none',
      confidence: typeof result.content.confidence === 'number' ? result.content.confidence : 0,
    });
  });

  return app;
}

interface IntentBody {
  transcript: string;
  npcContext: { name: string; role: string; npcText?: string; hintExamples?: string[] };
  candidateIntents: Array<{ intentId: string; description: string }>;
  conversationHistory: Array<{ role: string; text: string }>;
}

type IntentBodyResult =
  | { ok: true; value: IntentBody }
  | { ok: false; error: string };

function parseIntentBody(body: unknown): IntentBodyResult {
  if (!isRecord(body)) return { ok: false, error: 'request body must be an object' };
  if (typeof body.transcript !== 'string') return { ok: false, error: 'transcript is required and must be a string' };

  const transcript = body.transcript.trim();
  if (!transcript) return { ok: false, error: 'transcript must be non-empty' };
  if (transcript.length > 500) return { ok: false, error: 'transcript is too long' };

  if (!isRecord(body.npcContext)) return { ok: false, error: 'npcContext is required' };
  const npcContext: IntentBody['npcContext'] = {
    name: '',
    role: '',
  };
  const name = readBoundedString(body.npcContext.name, 80, 'npcContext.name');
  if (!name.ok) return name;
  npcContext.name = name.value;
  const role = readBoundedString(body.npcContext.role, 160, 'npcContext.role');
  if (!role.ok) return role;
  npcContext.role = role.value;

  if (typeof body.npcContext.npcText === 'string' && body.npcContext.npcText.trim()) {
    npcContext.npcText = body.npcContext.npcText.trim().slice(0, 500);
  }
  if (Array.isArray(body.npcContext.hintExamples)) {
    npcContext.hintExamples = body.npcContext.hintExamples
      .filter((h: unknown): h is string => typeof h === 'string' && h.trim().length > 0)
      .slice(0, 10)
      .map((h: string) => h.trim());
  }

  if (!Array.isArray(body.candidateIntents)) {
    return { ok: false, error: 'candidateIntents must be an array' };
  }
  if (body.candidateIntents.length === 0 || body.candidateIntents.length > 12) {
    return { ok: false, error: 'candidateIntents must include 1-12 items' };
  }
  const candidateIntents = [];
  for (const candidate of body.candidateIntents) {
    if (!isRecord(candidate)) return { ok: false, error: 'candidate intent must be an object' };
    const intentId = readBoundedString(candidate.intentId, 80, 'candidate intentId');
    if (!intentId.ok) return intentId;
    if (!/^[A-Za-z0-9_-]+$/.test(intentId.value)) {
      return { ok: false, error: 'candidate intentId is invalid' };
    }
    const description = readBoundedString(candidate.description, 300, 'candidate description');
    if (!description.ok) return description;
    candidateIntents.push({ intentId: intentId.value, description: description.value });
  }

  if (!Array.isArray(body.conversationHistory)) {
    return { ok: false, error: 'conversationHistory must be an array' };
  }
  if (body.conversationHistory.length > 12) {
    return { ok: false, error: 'conversationHistory is too long' };
  }
  const conversationHistory = [];
  for (const message of body.conversationHistory) {
    if (!isRecord(message)) return { ok: false, error: 'conversation history message must be an object' };
    const role = readBoundedString(message.role, 40, 'conversation role');
    if (!role.ok) return role;
    const text = readBoundedString(message.text, 300, 'conversation text');
    if (!text.ok) return text;
    conversationHistory.push({ role: role.value, text: text.value });
  }

  return {
    ok: true,
    value: {
      transcript,
      npcContext,
      candidateIntents,
      conversationHistory,
    },
  };
}

type StringResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

function readBoundedString(value: unknown, maxLength: number, label: string): StringResult {
  if (typeof value !== 'string') return { ok: false, error: `${label} must be a string` };
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: `${label} must be non-empty` };
  if (trimmed.length > maxLength) return { ok: false, error: `${label} is too long` };
  return { ok: true, value: trimmed };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
