import type { FastifyInstance } from 'fastify';

export async function intentRoutes(app: FastifyInstance) {
  app.post('/intent', async (request, reply) => {
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    if (!DEEPSEEK_API_KEY) {
      return reply.status(500).send({ error: 'DEEPSEEK_API_KEY not configured' });
    }

    const body = request.body as {
      transcript: string;
      npcContext: { name: string; role: string };
      candidateIntents: Array<{ intentId: string; description: string }>;
      conversationHistory: Array<{ role: string; text: string }>;
    };

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

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 100,
      }),
    });

    const result = await response.json();
    const content = JSON.parse(result.choices?.[0]?.message?.content ?? '{"intentId":"none","confidence":0}');
    return reply.send(content);
  });
}
