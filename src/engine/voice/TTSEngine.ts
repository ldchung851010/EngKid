/**
 * TTS Engine — Kitten TTS via Web Worker + ONNX Runtime Web.
 *
 * Mandatory: model files must be in public/tts-model/:
 *   - model_quantized.onnx
 *   - voices.json
 *
 * Download from HuggingFace: KittenML/kitten-tts-nano-0.1
 */

export type TTSEngineState = 'uninitialized' | 'loading' | 'ready' | 'error';

export interface TTSEngineStatus {
  state: TTSEngineState;
  progress: string;
  error: string | null;
}

type StatusCallback = (status: TTSEngineStatus) => void;

export class TTSEngine {
  private worker: Worker | null = null;
  private audioContext: AudioContext | null = null;
  private status: TTSEngineStatus = {
    state: 'uninitialized',
    progress: '',
    error: null,
  };
  private onStatus: StatusCallback | null = null;

  /** Listen for status changes (loading, progress, ready, error) */
  onStatusChange(cb: StatusCallback): void {
    this.onStatus = cb;
    cb(this.status);
  }

  /** Initialize: load ONNX model in Web Worker. Must succeed to proceed. */
  async init(modelPath = '/tts-model/'): Promise<void> {
    if (this.status.state === 'ready') return;
    if (this.status.state === 'loading') {
      // Wait for ongoing init to complete
      return new Promise((resolve, reject) => {
        const check = setInterval(() => {
          if (this.status.state === 'ready') { clearInterval(check); resolve(); }
          if (this.status.state === 'error') { clearInterval(check); reject(new Error(this.status.error!)); }
        }, 200);
      });
    }

    this.setState('loading', 'Creating Web Worker...');

    try {
      this.worker = new Worker(
        new URL('../../workers/tts-worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.setState('loading', 'Loading ONNX Runtime...');

      // Listen for worker messages
      this.worker.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.type === 'progress') {
          this.setState('loading', msg.status);
        } else if (msg.type === 'ready') {
          this.setState('ready', 'TTS model loaded');
        } else if (msg.type === 'error') {
          this.setState('error', msg.message);
        }
      };

      this.worker.onerror = (err) => {
        this.setState('error', `Worker error: ${err.message}`);
      };

      // Send init command to worker
      this.worker.postMessage({ type: 'init', modelPath });

      // Wait for ready or error
      await new Promise<void>((resolve, reject) => {
        const check = setInterval(() => {
          if (this.status.state === 'ready') { clearInterval(check); resolve(); }
          if (this.status.state === 'error') { clearInterval(check); reject(new Error(this.status.error!)); }
        }, 200);
      });
    } catch (err) {
      this.setState('error', String(err));
      throw err;
    }
  }

  /**
   * Speak text. Only works in 'ready' state.
   * Must call init() and wait for 'ready' first.
   */
  async speak(text: string, voice: string, speed = 1.0): Promise<void> {
    if (this.status.state !== 'ready' || !this.worker) {
      throw new Error('TTS engine not ready');
    }

    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    return new Promise((resolve, reject) => {
      this.worker!.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.type === 'audio') {
          // Play the generated audio
          const { data, sampleRate } = msg;
          const audioBuffer = this.audioContext!.createBuffer(1, data.length, sampleRate);
          audioBuffer.copyToChannel(data, 0);
          const source = this.audioContext!.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(this.audioContext!.destination);
          source.onended = () => resolve();
          source.start();
        } else if (msg.type === 'error') {
          reject(new Error(msg.message));
        }
      };

      this.worker!.postMessage({ type: 'generate', text, voiceId: voice, speed });
    });
  }

  /** Interrupt current speech */
  interrupt(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  dispose(): void {
    this.interrupt();
    this.worker?.terminate();
    this.worker = null;
    this.status = { state: 'uninitialized', progress: '', error: null };
  }

  private setState(state: TTSEngineState, progress: string): void {
    this.status = { state, progress, error: state === 'error' ? progress : null };
    this.onStatus?.(this.status);
  }
}

/** Singleton */
export const ttsEngine = new TTSEngine();
