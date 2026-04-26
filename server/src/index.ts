import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { spawn, type ChildProcess } from 'child_process';
import { asrRoutes } from './routes/asr.js';
import { intentRoutes } from './routes/intent.js';
import { ttsRoutes } from './routes/tts.js';

const TTS_PORT = parseInt(process.env.TTS_PORT || '8081');
const TTS_MODEL_PATH = process.env.TTS_MODEL_PATH || '';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(multipart);

// Start kitten-tts-server
let ttsProcess: ChildProcess | null = null;

function startTTSServer(): void {
  const binPath = new URL('../bin/kitten-tts-server', import.meta.url).pathname;
  const args = TTS_MODEL_PATH ? [TTS_MODEL_PATH, '--port', String(TTS_PORT)] : ['--port', String(TTS_PORT)];
  console.log(`[TTS] starting: ${binPath} ${args.join(' ')}`);

  ttsProcess = spawn(binPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  ttsProcess.stdout?.on('data', (d: Buffer) => console.log(`[TTS server] ${d.toString().trim()}`));
  ttsProcess.stderr?.on('data', (d: Buffer) => console.log(`[TTS server] ${d.toString().trim()}`));
  ttsProcess.on('exit', (code) => console.log(`[TTS] server exited code=${code}`));
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

// Start TTS and wait
startTTSServer();
await waitForTTS();

// Routes
app.addHook('onRequest', async (request) => {
  console.log(`[server] ← ${request.method} ${request.url}`);
});

app.addHook('onResponse', async (request, reply) => {
  console.log(`[server] → ${reply.statusCode} ${request.method} ${request.url} (${Math.round(reply.elapsedTime)}ms)`);
});

await app.register(asrRoutes, { prefix: '/api' });
await app.register(intentRoutes, { prefix: '/api' });
await app.register(ttsRoutes(TTS_PORT), { prefix: '/api' });

app.get('/api/health', async () => ({ status: 'ok', tts: 'ready' }));

try {
  await app.listen({ port: 3001 });
  console.log('🚀 Server listening on http://localhost:3001');
} catch (err) {
  app.log.error(err);
  ttsProcess?.kill();
  process.exit(1);
}

// Cleanup
process.on('SIGTERM', () => ttsProcess?.kill());
process.on('SIGINT', () => { ttsProcess?.kill(); process.exit(0); });
