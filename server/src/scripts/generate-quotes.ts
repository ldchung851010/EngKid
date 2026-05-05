import { ensureQuotesGenerated } from '../utils/quoteGenerator.js';

const GLM_API_KEY = process.env.GLM_API_KEY;
const TTS_PORT = parseInt(process.env.TTS_PORT || '8081');
const USE_CLOUD_TTS = !!GLM_API_KEY;

console.log('[generate-quotes] starting...');
const manifest = await ensureQuotesGenerated({
  ttsPort: USE_CLOUD_TTS ? undefined : TTS_PORT,
  glmApiKey: GLM_API_KEY,
  voice: process.env.TTS_VOICE,
});
console.log(`[generate-quotes] done: ${manifest.quotes.length} quotes`);
