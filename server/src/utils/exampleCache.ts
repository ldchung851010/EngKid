import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CACHE_DIR = path.resolve(__dirname, '../../data/example-cache');
const CACHE_DIR = process.env.EXAMPLE_CACHE_DIR || DEFAULT_CACHE_DIR;

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
  try {
    const raw = await fs.readFile(cachePath(keyInput), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<CachedExample>;
    if (typeof parsed.sentence !== 'string' || typeof parsed.explanation !== 'string') return null;
    return { sentence: parsed.sentence, explanation: parsed.explanation };
  } catch {
    return null;
  }
}

export async function writeCachedExample(keyInput: ExampleCacheKeyInput, example: CachedExample): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(cachePath(keyInput), JSON.stringify(example, null, 2));
}

function cachePath(keyInput: ExampleCacheKeyInput): string {
  return path.join(CACHE_DIR, `${cacheKey(keyInput)}.json`);
}

function cacheKey(keyInput: ExampleCacheKeyInput): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      word: normalizeWord(keyInput.word),
      cefrLevel: keyInput.cefrLevel,
      model: keyInput.model,
      promptVersion: keyInput.promptVersion,
    }))
    .digest('hex');
}

function normalizeWord(word: string): string {
  return word.trim().toLowerCase().replace(/\s+/g, ' ');
}
