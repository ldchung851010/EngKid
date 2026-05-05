import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs/promises';
import { initConfig } from './config.js';
import { initQuota, readPositiveInt } from './utils/quota.js';
import { initCacheFs } from './utils/cacheFs.js';
import { intentRoutes } from './routes/intent.js';
import { ttsRoutes } from './routes/tts.js';
import { exampleRoutes } from './routes/example.js';
import { scenesRoutes } from './routes/scenes.js';
import { quotesRoutes } from './routes/quotes.js';
import { quotaRoutes } from './routes/quota.js';
import { asrRoutes } from './routes/asr.js';
import { ensureQuotesGenerated } from './utils/quoteGenerator.js';

// Initialize config from environment
const DEFAULT_TTS_CACHE_DIR = new URL('../data/tts-cache', import.meta.url).pathname;
const DEFAULT_EXAMPLE_CACHE_DIR = new URL('../data/example-cache', import.meta.url).pathname;

initConfig({
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',
  deepseekModel: process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
  glmApiKey: process.env.GLM_API_KEY ?? '',
  ttsVoice: process.env.TTS_VOICE ?? 'Kiki',
  ttsCacheDir: process.env.TTS_CACHE_DIR ?? DEFAULT_TTS_CACHE_DIR,
  exampleCacheDir: process.env.EXAMPLE_CACHE_DIR ?? DEFAULT_EXAMPLE_CACHE_DIR,
  corsOrigin: process.env.CORS_ORIGIN ?? '',
  nodeEnv: process.env.NODE_ENV ?? '',
});

// Initialize quota limits from environment
initQuota({
  ai: {
    dailyLimit: readPositiveInt('AI_DAILY_LIMIT', 5000),
    ipHourlyLimit: readPositiveInt('AI_IP_HOURLY_LIMIT', 300),
  },
  tts: {
    dailyLimit: readPositiveInt('TTS_DAILY_LIMIT', 10000),
    ipHourlyLimit: readPositiveInt('TTS_IP_HOURLY_LIMIT', 600),
  },
  asr: {
    dailyLimit: readPositiveInt('ASR_DAILY_LIMIT', 5000),
    ipHourlyLimit: readPositiveInt('ASR_IP_HOURLY_LIMIT', 300),
  },
});

// Initialize cache filesystem (Node.js fs/promises)
initCacheFs({
  readFile: async (path) => new Uint8Array(await fs.readFile(path)),
  readFileUtf8: (path) => fs.readFile(path, 'utf-8'),
  writeFile: (path, data) => fs.writeFile(path, data),
  mkdir: (path, opts) => fs.mkdir(path, opts).then(() => undefined),
});

const TTS_PORT = parseInt(process.env.TTS_PORT || '8081');
const TTS_MODEL_PATH = process.env.TTS_MODEL_PATH ||
  new URL('../model', import.meta.url).pathname;
const SERVER_BODY_LIMIT = readPositiveInt('SERVER_BODY_LIMIT', 256 * 1024);
const GLM_API_KEY = process.env.GLM_API_KEY;

const USE_CLOUD_TTS = !!GLM_API_KEY;

let ttsProcess: ChildProcess | null = null;

if (!USE_CLOUD_TTS) {
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

  async function waitForTTS(timeoutMs = 15000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://localhost:${TTS_PORT}/health`);
        if (res.ok) {
          const ct = res.headers.get('content-type') ?? '';
          if (ct.includes('json') || ct.includes('text/plain')) {
            console.log('[TTS] server ready');
            return;
          }
        }
      } catch { /* not ready yet */ }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('TTS server failed to start');
  }

  ttsProcess = startTTSServer();
  await waitForTTS();
} else {
  console.log('[TTS] cloud mode (GLM-TTS)');
}

// Pre-generate quote audio files
await ensureQuotesGenerated({
  ttsPort: USE_CLOUD_TTS ? undefined : TTS_PORT,
  glmApiKey: GLM_API_KEY,
  voice: process.env.TTS_VOICE,
});

// CORS origins
function getAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN ?? '';
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (list.length === 0 && process.env.NODE_ENV !== 'production') {
    list.push('http://localhost:5173', 'http://127.0.0.1:5173');
  }
  return list;
}

// Hono app
const app = new Hono();

// Logging middleware
app.use('*', async (c, next) => {
  console.log(`[server] ← ${c.req.method} ${c.req.path}`);
  const start = Date.now();
  await next();
  console.log(`[server] → ${c.res.status} ${c.req.method} ${c.req.path} (${Date.now() - start}ms)`);
});

// Body size limit middleware
app.use('*', async (c, next) => {
  const contentLength = c.req.header('content-length');
  if (contentLength && parseInt(contentLength) > SERVER_BODY_LIMIT) {
    return c.json({ error: 'Request body too large' }, 413);
  }
  await next();
});

// CORS middleware
app.use('*', cors({
  origin: (origin) => {
    const allowed = getAllowedOrigins();
    if (!origin || allowed.includes(origin)) return origin ?? '*';
    return null;
  },
}));

// API routes
app.route('/api', intentRoutes());
app.route('/api', ttsRoutes({
  ttsPort: USE_CLOUD_TTS ? undefined : TTS_PORT,
  glmApiKey: GLM_API_KEY,
  cloudVoice: process.env.TTS_VOICE,
}));
app.route('/api', exampleRoutes());

// Load scenes metadata (generated by postbuild script)
let scenesData: { scenes: unknown[] } | undefined;
try {
  const metaPath = new URL('../data/scenes-metadata.json', import.meta.url).pathname;
  const raw = await fs.readFile(metaPath, 'utf-8');
  scenesData = JSON.parse(raw);
} catch { /* not generated yet, routes will return empty */ }

app.route('/api', scenesRoutes(scenesData));
app.route('/api', quotesRoutes());
app.route('/api', quotaRoutes());

if (GLM_API_KEY) {
  app.route('/api', asrRoutes());
  console.log('[ASR] cloud mode (GLM-ASR-2512)');
}

app.get('/api/health', (c) => c.json({
  status: 'ok',
  tts: USE_CLOUD_TTS ? 'cloud' : 'ready',
  asr: GLM_API_KEY ? 'cloud' : 'local',
}));

// Start server
serve({
  fetch: app.fetch,
  port: 3001,
}, (info) => {
  console.log(`🚀 Server listening on http://localhost:${info.port}`);
});

// Cleanup
process.on('SIGTERM', () => ttsProcess?.kill());
process.on('SIGINT', () => { ttsProcess?.kill(); process.exit(0); });
