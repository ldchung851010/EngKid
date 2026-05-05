import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { spawn, type ChildProcess } from 'child_process';
import { intentRoutes } from './routes/intent.js';
import { ttsRoutes } from './routes/tts.js';
import { exampleRoutes } from './routes/example.js';
import { scenesRoutes } from './routes/scenes.js';
import { quotesRoutes } from './routes/quotes.js';
import { quotaRoutes } from './routes/quota.js';
import { asrRoutes } from './routes/asr.js';
import { ensureQuotesGenerated } from './utils/quoteGenerator.js';

const TTS_PORT = parseInt(process.env.TTS_PORT || '8081');
const TTS_MODEL_PATH = process.env.TTS_MODEL_PATH ||
  new URL('../model', import.meta.url).pathname;
const SERVER_BODY_LIMIT = readPositiveInt('SERVER_BODY_LIMIT', 256 * 1024);
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

const app = Fastify({
  logger: true,
  bodyLimit: SERVER_BODY_LIMIT,
  trustProxy: TRUST_PROXY,
});

await app.register(cors, { origin: createCorsOrigin() });
await app.register(multipart);

// Start kitten-tts-server
function startTTSServer(): ChildProcess {
  const binPath = getTTSBinaryPath();
  const args = [TTS_MODEL_PATH, '--port', String(TTS_PORT)];
  console.log(`[TTS] starting: ${binPath} ${args.join(' ')}`);

  const proc = spawn(binPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout?.on('data', (d: Buffer) => console.log(`[TTS server] ${d.toString().trim()}`));
  proc.stderr?.on('data', (d: Buffer) => console.log(`[TTS server] ${d.toString().trim()}`));
  proc.on('exit', (code) => console.log(`[TTS] server exited code=${code}`));
  return proc;
}

function getTTSBinaryPath(): string {
  const binaryName = getTTSBinaryName();
  return new URL(`../bin/${binaryName}`, import.meta.url).pathname;
}

function getTTSBinaryName(): string {
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    return 'kitten-tts-server-aarch64-macos';
  }

  if (process.platform === 'linux' && process.arch === 'x64') {
    return 'kitten-tts-server-x86_64-linux';
  }

  throw new Error(`Unsupported TTS platform: ${process.platform}/${process.arch}`);
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

await app.register(intentRoutes, { prefix: '/api' });
await app.register(ttsRoutes(TTS_PORT), { prefix: '/api' });
await app.register(exampleRoutes, { prefix: '/api' });
await app.register(scenesRoutes, { prefix: '/api' });
await app.register(quotesRoutes(), { prefix: '/api' });
await app.register(quotaRoutes, { prefix: '/api' });

if (process.env.GLM_API_KEY) {
  await app.register(asrRoutes, { prefix: '/api' });
  console.log('[ASR] cloud mode (GLM-ASR-2512)');
}

app.get('/api/health', async () => ({
  status: 'ok',
  tts: 'ready',
  asr: process.env.GLM_API_KEY ? 'cloud' : 'local',
}));

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

function createCorsOrigin() {
  const allowedOrigins = parseList(process.env.CORS_ORIGIN);
  if (allowedOrigins.length === 0 && process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');
  }

  return (origin: string | undefined, callback: (error: Error | null, allow: boolean) => void) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  };
}

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readPositiveInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
