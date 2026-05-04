/**
 * WhisperASR — 浏览器本地 whisper.cpp WASM 封装。
 *
 * 模型从远程下载，首次缓存到 IndexedDB，后续直接从 IndexedDB 读取。
 * 识别文本通过 stdout/stderr 异步输出，full_default 立即返回。
 *
 * whisper.js 在加载时将 defaultPrint 绑定为 console.log.bind(console)。
 * 为了捕获其输出，play.html 在加载 whisper.js 之前安装了 console.log/error
 * 代理，我们通过 window.__whisperCollect 开关来控制是否收集。
 */

declare const Module: WhisperModule;

declare global {
  interface Window {
    __whisperCollect: ((text: string) => void) | null;
  }
}

interface WhisperModule {
  init: (filename: string) => number;
  full_default: (
    instance: number,
    audio: Float32Array,
    language: string,
    nthreads: number,
    translate: boolean
  ) => number;
  FS_createDataFile: (
    path: string,
    name: string,
    data: Uint8Array,
    canRead: boolean,
    canWrite: boolean
  ) => void;
  FS_unlink: (path: string) => void;
}

function parseWhisperOutput(lines: string[]): string {
  const results: string[] = [];
  for (const line of lines) {
    // Match lines like: [00:00:00.000 --> 00:00:02.000]   Where is the monkey?
    const m = line.match(/^\[\d{2}:\d{2}:\d{2}\.\d+\s+-->\s+\d{2}:\d{2}:\d{2}\.\d+\]\s+(.*)$/);
    if (m) {
      const text = m[1].trim();
      if (text) results.push(text);
    }
  }
  return results.join(' ').trim();
}

/** Simple IndexedDB cache for model binaries */
class ModelCache {
  private dbName = 'whisper-models';
  private storeName = 'models';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async get(key: string): Promise<Uint8Array | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (result?.data) {
          resolve(new Uint8Array(result.data));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async set(key: string, data: Uint8Array): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(
        { data: data.buffer, size: data.length, timestamp: Date.now() },
        key
      );
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export class WhisperASR {
  private instance: number | null = null;
  private modelLoaded = false;

  get isLoaded(): boolean {
    return this.modelLoaded;
  }

  async loadModel(
    modelUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
    onProgress?: (pct: number) => void
  ): Promise<void> {
    if (this.modelLoaded) return;

    const cache = new ModelCache();
    const cacheKey = modelUrl.split('/').pop() || 'model.bin';

    // 1. Try IndexedDB first
    let buf = await cache.get(cacheKey);
    if (buf) {
      console.log(
        `[WhisperASR] loaded model from IndexedDB (${(buf.length / 1024 / 1024).toFixed(1)}MB)`
      );
    } else {
      // 2. Download from remote with progress
      console.log(`[WhisperASR] downloading model from ${modelUrl}...`);
      buf = await this.download(modelUrl, onProgress);

      // 3. Save to IndexedDB
      await cache.set(cacheKey, buf);
      console.log(`[WhisperASR] model cached to IndexedDB`);
    }

    // Load into WASM virtual file system
    try {
      Module.FS_unlink('/whisper.bin');
    } catch {
      // ignore if file doesn't exist
    }
    Module.FS_createDataFile('/', 'whisper.bin', buf, true, true);
    this.instance = Module.init('whisper.bin');
    this.modelLoaded = true;
    if (onProgress) onProgress(100);
  }

  private async download(url: string, onProgress?: (pct: number) => void): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';

      xhr.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(new Uint8Array(xhr.response));
        } else {
          reject(new Error(`Download failed: HTTP ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error(`Failed to download model from ${url}`));
      xhr.send();
    });
  }

  async transcribe(
    audioData: Float32Array,
    options: { language?: string; nThreads?: number } = {}
  ): Promise<string> {
    if (!this.instance) {
      throw new Error('Whisper model not loaded');
    }
    const language = options.language || 'en';
    const nThreads = options.nThreads || 8;

    // Capture output via the console proxy installed in play.html
    const captured: string[] = [];
    let lastOutputTime = Date.now();
    let hasResult = false;

    const collect = (text: string) => {
      captured.push(text);
      lastOutputTime = Date.now();
      if (text.includes('-->')) {
        hasResult = true;
      }
    };

    window.__whisperCollect = collect;

    const start = performance.now();
    Module.full_default(this.instance, audioData, language, nThreads, false);

    // Wait for async pthread output to finish.
    // Once we see a result timestamp, wait 2s of silence.
    // Before any result, wait up to 4s of silence (covers encoding gap).
    await new Promise<void>((resolve) => {
      const deadline = Date.now() + 15000;
      const check = () => {
        const silence = Date.now() - lastOutputTime;
        const threshold = hasResult ? 2000 : 4000;
        if (silence > threshold || Date.now() > deadline) {
          resolve();
          return;
        }
        setTimeout(check, 50);
      };
      setTimeout(check, 200);
    });

    // Extra grace period to catch any trailing output
    await new Promise((r) => setTimeout(r, 300));
    window.__whisperCollect = null;

    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    const text = parseWhisperOutput(captured);
    console.log(`[WhisperASR] transcribed in ${elapsed}s: "${text}"`);
    return text;
  }
}
