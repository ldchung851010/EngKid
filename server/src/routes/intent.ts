import type { FastifyInstance } from 'fastify';
import { callTextAIJson } from '../utils/aiGateway.js';

export async function intentRoutes(app: FastifyInstance) {
  app.post('/intent', async (request, reply) => {
    const body = request.body as {
      transcript: string;
      npcContext: { name: string; role: string };
      candidateIntents: Array<{ intentId: string; description: string }>;
      conversationHistory: Array<{ role: string; text: string }>;
    };

    console.log(`[Intent] ← transcript="${body.transcript}", candidates=[${body.candidateIntents.map(c => c.intentId).join(',')}]`);

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
