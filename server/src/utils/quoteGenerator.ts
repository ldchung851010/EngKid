import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pcmToWav } from './audio.js';

const GLM_TTS_URL = 'https://open.bigmodel.cn/api/paas/v4/audio/speech';
const GLM_TTS_MODEL = 'glm-tts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 10 pre-defined kid-friendly English quotes */
export const QUOTES: string[] = [
  "Hey there! Ready to learn some awesome English today?",
  "Meow! You are doing pawsome! Keep it up!",
  "Did you know? Practice makes purr-fect!",
  "Wow! You are such a clever learner!",
  "Let's go on a fun English adventure together!",
  "High five! You are getting better every day!",
  "Remember: every big journey starts with a small step!",
  "You are a superstar learner! Shine bright!",
  "Learning English is like a fun game. Let's play!",
  "I believe in you! You can do amazing things!",
];

export interface QuoteManifest {
  quotes: { id: number; text: string; audioFile: string }[];
}

const DATA_DIR = path.resolve(__dirname, '../../data/quotes');
const MANIFEST_PATH = path.join(DATA_DIR, 'manifest.json');

export function getQuotesDir(): string {
  return DATA_DIR;
}

export function getManifestPath(): string {
  return MANIFEST_PATH;
}

export async function loadManifest(): Promise<QuoteManifest | null> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf-8');
    return JSON.parse(raw) as QuoteManifest;
  } catch {
    return null;
  }
}

interface QuoteTTSConfig {
  ttsPort?: number;
  glmApiKey?: string;
  voice?: string;
}

export async function ensureQuotesGenerated(config: QuoteTTSConfig): Promise<QuoteManifest> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const existing = await loadManifest();
  if (existing && existing.quotes.length === QUOTES.length) {
    // Verify all audio files exist
    const allExist = await Promise.all(
      existing.quotes.map((q) =>
        fs.access(path.join(DATA_DIR, q.audioFile)).then(() => true).catch(() => false)
      )
    );
    if (allExist.every(Boolean)) {
      console.log('[quotes] all audio files already generated');
      return existing;
    }
  }

  console.log('[quotes] generating audio files...');
  const manifest: QuoteManifest = { quotes: [] };

  for (let i = 0; i < QUOTES.length; i++) {
    const text = QUOTES[i];
    const fileName = `quote-${i}.wav`;
    const filePath = path.join(DATA_DIR, fileName);

    try {
      const pcmBuffer = await generateTTS(config, text);
      const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);
      await fs.writeFile(filePath, wavBuffer);
      console.log(`[quotes] ✓ quote-${i}.wav (${wavBuffer.length} bytes)`);
      manifest.quotes.push({ id: i, text, audioFile: fileName });
    } catch (err) {
      console.error(`[quotes] ✗ failed to generate quote-${i}:`, err);
    }
  }

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`[quotes] manifest saved (${manifest.quotes.length}/${QUOTES.length} quotes)`);
  return manifest;
}

async function generateTTS(config: QuoteTTSConfig, text: string): Promise<Buffer> {
  const voice = config.voice ?? 'Kiki';

  if (config.glmApiKey) {
    const res = await fetch(GLM_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.glmApiKey}`,
      },
      body: JSON.stringify({
        model: GLM_TTS_MODEL,
        input: text,
        voice,
        speed: 1.0,
        response_format: 'wav',
      }),
    });

    if (!res.ok) {
      throw new Error(`GLM-TTS error: ${res.status}`);
    }

    return Buffer.from(await res.arrayBuffer());
  }

  const res = await fetch(`http://localhost:${config.ttsPort}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: text,
      voice,
      response_format: 'pcm',
      stream: false,
      speed: 1.0,
    }),
  });

  if (!res.ok) {
    throw new Error(`TTS upstream error: ${res.status}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
