import type { FastifyInstance } from 'fastify';
import { callTextAIJson } from '../utils/aiGateway.js';

export async function intentRoutes(app: FastifyInstance) {
  app.post('/intent', async (request, reply) => {
    const parsed = parseIntentBody(request.body);
    if (!parsed.ok) return reply.status(400).send({ error: parsed.error });

    const body = parsed.value;
    console.log(`[Intent] ← candidates=[${body.candidateIntents.map(c => c.intentId).join(',')}]`);

    const prompt = `You are an intent router for a children's English learning game.

NPC: ${body.npcContext.name} (${body.npcContext.role})

The child said: "${body.transcript}"

Candidate intents:
${body.candidateIntents.map((i) => `- ${i.intentId}: ${i.description}`).join('\n')}

Conversation history:
${body.conversationHistory.map((m) => `- ${m.role}: ${m.text}`).join('\n')}

Rules:
1. Match the child's utterance to the BEST matching intent
2. If no intent matches, return "none"
3. Consider: children may mispronounce words, use ungrammatical sentences
4. The INTENT matters, not perfect phrasing

Return ONLY a JSON object: {"intentId": "<id or 'none'>", "confidence": <0.0-1.0>}`;

    const result = await callTextAIJson(request, {
      logName: 'Intent',
      prompt,
      temperature: 0.1,
      maxTokens: 100,
    });
    if (!result.ok) {
      if (result.body.retryAfterSeconds) reply.header('Retry-After', result.body.retryAfterSeconds);
      return reply.status(result.statusCode).send(result.body);
    }
    return reply.send({
      intentId: typeof result.content.intentId === 'string' ? result.content.intentId : 'none',
      confidence: typeof result.content.confidence === 'number' ? result.content.confidence : 0,
    });
  });
}

interface IntentBody {
  transcript: string;
  npcContext: { name: string; role: string };
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
  const npcContext = {
    name: readBoundedString(body.npcContext.name, 80, 'npcContext.name'),
    role: readBoundedString(body.npcContext.role, 160, 'npcContext.role'),
  };
  if (!npcContext.name.ok) return npcContext.name;
  if (!npcContext.role.ok) return npcContext.role;

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
      npcContext: { name: npcContext.name.value, role: npcContext.role.value },
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
