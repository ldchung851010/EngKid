import { getConfig } from '../config.js';
import { getCacheFs } from './cacheFs.js';

export const EXAMPLE_PROMPT_VERSION = 1;

export interface ExampleCacheKeyInput {
  word: string;
  cefrLevel: 'A1' | 'A2';
  model: string;
  promptVersion: number;
}

export interface CachedExample {
  sentence: string;
  explanation: string;
}

export async function readCachedExample(keyInput: ExampleCacheKeyInput): Promise<CachedExample | null> {
  const cacheDir = getConfig().exampleCacheDir;
  if (!cacheDir) return null;

  const fs = getCacheFs();
  if (!fs) return null;

  try {
    const filePath = `${cacheDir}/${await cacheKey(keyInput)}.json`;
    const raw = await fs.readFileUtf8(filePath);
    const parsed = JSON.parse(raw) as Partial<CachedExample>;
    if (typeof parsed.sentence !== 'string' || typeof parsed.explanation !== 'string') return null;
    return { sentence: parsed.sentence, explanation: parsed.explanation };
  } catch {
    return null;
  }
}

export async function writeCachedExample(keyInput: ExampleCacheKeyInput, example: CachedExample): Promise<void> {
  const cacheDir = getConfig().exampleCacheDir;
  if (!cacheDir) return;

  const fs = getCacheFs();
  if (!fs) return;

  await fs.mkdir(cacheDir, { recursive: true });
  const filePath = `${cacheDir}/${await cacheKey(keyInput)}.json`;
  await fs.writeFile(filePath, JSON.stringify(example, null, 2));
}

async function cacheKey(keyInput: ExampleCacheKeyInput): Promise<string> {
  return sha256Hex(JSON.stringify({
    word: normalizeWord(keyInput.word),
    cefrLevel: keyInput.cefrLevel,
    model: keyInput.model,
    promptVersion: keyInput.promptVersion,
  }));
}

function normalizeWord(word: string): string {
  return word.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}
