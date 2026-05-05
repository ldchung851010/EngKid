import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { initConfig, getConfig } from './config.js';
import { initQuota } from './utils/quota.js';
import { intentRoutes } from './routes/intent.js';
import { ttsRoutes } from './routes/tts.js';
import { exampleRoutes } from './routes/example.js';
import { scenesRoutes } from './routes/scenes.js';
import { quotaRoutes } from './routes/quota.js';
import { asrRoutes } from './routes/asr.js';
import scenesData from '../data/scenes-metadata.json';

type Env = {
  Bindings: {
    DEEPSEEK_API_KEY: string;
    DEEPSEEK_MODEL: string;
    GLM_API_KEY: string;
    TTS_VOICE: string;
    CORS_ORIGIN: string;
  };
};

const app = new Hono<Env>();

// Config init middleware — runs before any route handler
let configInitialized = false;
app.use('*', async (c, next) => {
  if (!configInitialized) {
    configInitialized = true;
    initConfig({
      deepseekApiKey: c.env.DEEPSEEK_API_KEY ?? '',
      deepseekModel: c.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
      glmApiKey: c.env.GLM_API_KEY ?? '',
      ttsVoice: c.env.TTS_VOICE ?? 'tongtong',
    });
    initQuota();
  }
  await next();
});

// Logging middleware
app.use('*', async (c, next) => {
  console.log(`[worker] ← ${c.req.method} ${c.req.path}`);
  const start = Date.now();
  await next();
  console.log(`[worker] → ${c.res.status} ${c.req.method} ${c.req.path} (${Date.now() - start}ms)`);
});

// CORS middleware
app.use('*', cors({
  origin: (origin, c) => {
    const raw = c.env.CORS_ORIGIN ?? '';
    const allowed = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (!origin || allowed.includes(origin)) return origin ?? '*';
    return null;
  },
}));

// Register all routes upfront (Hono requires routes before first request)
app.route('/api', intentRoutes());
app.route('/api', ttsRoutes({
  glmApiKey: '', // will be read from config at request time
  cloudVoice: '', // will be read from config at request time
}));
app.route('/api', exampleRoutes());
app.route('/api', scenesRoutes(scenesData));
app.route('/api', quotaRoutes());
app.route('/api', asrRoutes());

app.get('/api/health', (c) => {
  const { glmApiKey } = getConfig();
  return c.json({
    status: 'ok',
    tts: glmApiKey ? 'cloud' : 'unavailable',
    asr: glmApiKey ? 'cloud' : 'local',
  });
});

export default app;
