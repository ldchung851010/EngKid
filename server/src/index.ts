import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { spawn, type ChildProcess } from 'child_process';
import { asrRoutes } from './routes/asr.js';
import { intentRoutes } from './routes/intent.js';
import { ttsRoutes } from './routes/tts.js';
import { progressRoutes } from './routes/progress.js';
import { collectiblesRoutes } from './routes/collectibles.js';
import { exampleRoutes } from './routes/example.js';
import { scenesRoutes } from './routes/scenes.js';
import { quotesRoutes } from './routes/quotes.js';
import { ensureQuotesGenerated } from './utils/quoteGenerator.js';

const TTS_PORT = parseInt(process.env.TTS_PORT || '8081');
const TTS_MODEL_PATH = process.env.TTS_MODEL_PATH ||
  new URL('../model', import.meta.url).pathname;

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(multipart);

// Start kitten-tts-server
function startTTSServer(): ChildProcess {
  const binPath = new URL('../bin/kitten-tts-server', import.meta.url).pathname;
  const args = [TTS_MODEL_PATH, '--port', String(TTS_PORT)];
  console.log(`[TTS] starting: ${binPath} ${args.join(' ')}`);

  const proc = spawn(binPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout?.on('data', (d: Buffer) => console.log(`[TTS server] ${d.toString().trim()}`));
  proc.stderr?.on('data', (d: Buffer) => console.log(`[TTS server] ${d.toString().trim()}`));
  proc.on('exit', (code) => console.log(`[TTS] server exited code=${code}`));
  return proc;
}

// Wait for TTS server to be ready
async function waitForTTS(timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${TTS_PORT}/health`);
      if (res.ok) { console.log('[TTS] server ready'); return; }
    } catch { /* not ready yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('TTS server failed to start');
}

const ttsProcess = startTTSServer();
await waitForTTS();

// Routes
app.addHook('onRequest', async (request) => {
  console.log(`[server] ← ${request.method} ${request.url}`);
});

app.addHook('onResponse', async (request, reply) => {
  console.log(`[server] → ${reply.statusCode} ${request.method} ${request.url} (${Math.round(reply.elapsedTime)}ms)`);
});

// Pre-generate quote audio files
await ensureQuotesGenerated(TTS_PORT);

await app.register(asrRoutes, { prefix: '/api' });
await app.register(intentRoutes, { prefix: '/api' });
await app.register(ttsRoutes(TTS_PORT), { prefix: '/api' });
await app.register(progressRoutes, { prefix: '/api' });
await app.register(collectiblesRoutes, { prefix: '/api' });
await app.register(exampleRoutes, { prefix: '/api' });
await app.register(scenesRoutes, { prefix: '/api' });
await app.register(quotesRoutes(), { prefix: '/api' });

app.get('/api/health', async () => ({ status: 'ok', tts: 'ready' }));

try {
  await app.listen({ port: 3001 });
  console.log('🚀 Server listening on http://localhost:3001');
} catch (err) {
  app.log.error(err);
  ttsProcess.kill();
  process.exit(1);
}

// Cleanup
process.on('SIGTERM', () => ttsProcess.kill());
process.on('SIGINT', () => { ttsProcess.kill(); process.exit(0); });
