import type { CacheFs } from './cacheFs.js';

export interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ArrayBuffer | ArrayBufferView | string | null | ReadableStream): Promise<R2Object>;
}

export interface R2Object {
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

/**
 * Creates a CacheFs adapter backed by Cloudflare R2.
 * Keys are derived from the filesystem path by stripping the leading slash.
 */
export function createR2CacheFs(bucket: R2Bucket): CacheFs {
  return {
    async readFile(path: string): Promise<Uint8Array> {
      const obj = await bucket.get(pathToKey(path));
      if (!obj) throw new Error(`R2 key not found: ${path}`);
      return new Uint8Array(await obj.arrayBuffer());
    },

    async readFileUtf8(path: string): Promise<string> {
      const obj = await bucket.get(pathToKey(path));
      if (!obj) throw new Error(`R2 key not found: ${path}`);
      return obj.text();
    },

    async writeFile(path: string, data: Uint8Array | string): Promise<void> {
      await bucket.put(pathToKey(path), data);
    },

    async mkdir(_path: string, _opts: { recursive: true }): Promise<void> {
      // R2 is flat — no directory creation needed
    },
  };
}

function pathToKey(path: string): string {
  return path.replace(/^\/+/, '');
}
