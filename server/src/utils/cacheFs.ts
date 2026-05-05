export interface CacheFs {
  readFile(path: string): Promise<Uint8Array>;
  readFileUtf8(path: string): Promise<string>;
  writeFile(path: string, data: Uint8Array | string): Promise<void>;
  mkdir(path: string, opts: { recursive: true }): Promise<void>;
}

let cacheFs: CacheFs | null = null;

export function initCacheFs(fs: CacheFs): void {
  cacheFs = fs;
}

export function getCacheFs(): CacheFs | null {
  return cacheFs;
}
