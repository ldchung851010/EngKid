import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CACHE_DIR = path.resolve(__dirname, '../../data/tts-cache');
const CACHE_DIR = process.env.TTS_CACHE_DIR || DEFAULT_CACHE_DIR;

export interface TTSCacheKeyInput {
  input: string;
  voice: string;
  speed: number;
}

export async function readCachedTTS(keyInput: TTSCacheKeyInput): Promise<Buffer | null> {
  try {
    return await fs.readFile(cachePath(keyInput));
  } catch {
    return null;
  }
}

export async function writeCachedTTS(keyInput: TTSCacheKeyInput, wavBuffer: Buffer): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(cachePath(keyInput), wavBuffer);
}

export function cachePath(keyInput: TTSCacheKeyInput): string {
  return path.join(CACHE_DIR, `${cacheKey(keyInput)}.wav`);
}

function cacheKey(keyInput: TTSCacheKeyInput): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      input: keyInput.input,
      voice: keyInput.voice,
      speed: keyInput.speed,
      format: 'wav',
      sampleRate: 24000,
      channels: 1,
      bitDepth: 16,
    }))
    .digest('hex');
}
