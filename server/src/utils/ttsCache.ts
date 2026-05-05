import { getConfig } from '../config.js';
import { getCacheFs } from './cacheFs.js';

export interface TTSCacheKeyInput {
  input: string;
  voice: string;
  speed: number;
}

export async function readCachedTTS(keyInput: TTSCacheKeyInput): Promise<Uint8Array | null> {
  const cacheDir = getConfig().ttsCacheDir;
  if (!cacheDir) return null;

  const fs = getCacheFs();
  if (!fs) return null;

  try {
    const filePath = `${cacheDir}/${await cacheKey(keyInput)}.wav`;
    const result = await fs.readFile(filePath);
    console.log(`[TTS-cache] HIT ${filePath}`);
    return result;
  } catch {
    console.log(`[TTS-cache] MISS`);
    return null;
  }
}

export async function writeCachedTTS(keyInput: TTSCacheKeyInput, wavBuffer: Uint8Array): Promise<void> {
  const cacheDir = getConfig().ttsCacheDir;
  if (!cacheDir) return;

  const fs = getCacheFs();
  if (!fs) return;

  await fs.mkdir(cacheDir, { recursive: true });
  const filePath = `${cacheDir}/${await cacheKey(keyInput)}.wav`;
  await fs.writeFile(filePath, wavBuffer);
}

async function cacheKey(keyInput: TTSCacheKeyInput): Promise<string> {
  return sha256Hex(JSON.stringify({
    input: keyInput.input,
    voice: keyInput.voice,
    speed: keyInput.speed,
    format: 'wav',
    sampleRate: 24000,
    channels: 1,
    bitDepth: 16,
  }));
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}
