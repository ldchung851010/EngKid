import type { FastifyInstance } from 'fastify';
import { pcmToWav } from '../utils/audio.js';

export function ttsRoutes(ttsPort: number) {
  return async function (app: FastifyInstance) {
    const ttsBase = `http://localhost:${ttsPort}`;

    app.post('/tts', async (request, reply) => {
      const body = request.body as { input: string; voice?: string; speed?: number };
      if (!body?.input) {
        return reply.status(400).send({ error: 'Missing "input" field' });
      }

      console.log(`[TTS] ← generate: "${body.input.substring(0, 40)}..."`);

      try {
        const res = await fetch(`${ttsBase}/v1/audio/speech`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: body.input,
            voice: body.voice || 'Kiki',
            response_format: 'pcm',
            stream: false,
            speed: body.speed || 1.0,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.log(`[TTS] ❌ upstream error ${res.status}: ${errText}`);
          return reply.status(502).send({ error: `TTS upstream error: ${res.status}` });
        }

        // kitten-tts-server returns raw PCM data
        const pcmBuffer = Buffer.from(await res.arrayBuffer());

        // Convert PCM to WAV header + PCM data for browser playback
        const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);

        reply.header('Content-Type', 'audio/wav');
        reply.header('Content-Length', wavBuffer.length);
        return reply.send(wavBuffer);
      } catch (err) {
        console.log('[TTS] ❌ error:', err);
        return reply.status(502).send({ error: 'TTS upstream unavailable' });
      }
    });
  };
}
