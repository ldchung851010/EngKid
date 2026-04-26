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
  private currentSource: AudioBufferSourceNode | null = null;
  private useBrowserFallback = false;
  private status: TTSEngineStatus = {
    state: 'uninitialized',
    progress: '',
    error: null,
  };
  private onStatus: StatusCallback | null = null;

  constructor() {
    this.installAudioUnlock();
  }

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
      if (this.enableBrowserFallback(err)) return;
      this.setState('error', String(err));
      throw err;
    }
  }

  /**
   * Speak text via Kitten TTS when available, otherwise browser SpeechSynthesis.
   */
  async speak(text: string, voice: string, speed = 1.0): Promise<void> {
    if (this.useBrowserFallback) {
      return this.speakWithBrowser(text, voice, speed);
    }

    if (this.status.state !== 'ready' || !this.worker) {
      if (this.enableBrowserFallback(new Error('TTS engine not ready'))) {
        return this.speakWithBrowser(text, voice, speed);
      }
      throw new Error('TTS engine not ready');
    }

    let audioContext: AudioContext;
    try {
      audioContext = await this.ensureAudioContext();
    } catch (err) {
      if (this.enableBrowserFallback(err)) {
        return this.speakWithBrowser(text, voice, speed);
      }
      throw err;
    }

    return new Promise((resolve, reject) => {
      this.worker!.onmessage = async (e: MessageEvent) => {
        const msg = e.data;
        if (msg.type === 'audio') {
          try {
            const { data, sampleRate } = msg;
            const audioData = data instanceof Float32Array ? data : new Float32Array(data);
            const peak = this.getPeak(audioData);

            if (audioData.length === 0 || peak < 0.002) {
              this.enableBrowserFallback(new Error(`Generated TTS audio is silent (peak=${peak})`));
              await this.speakWithBrowser(text, voice, speed);
              resolve();
              return;
            }

            if (audioContext.state === 'suspended') {
              await audioContext.resume();
            }

            const audioBuffer = audioContext.createBuffer(1, audioData.length, sampleRate);
            audioBuffer.copyToChannel(audioData, 0);
            const source = audioContext.createBufferSource();
            this.currentSource = source;
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.onended = () => {
              if (this.currentSource === source) this.currentSource = null;
              resolve();
            };
            source.start();
          } catch (err) {
            if (this.enableBrowserFallback(err)) {
              this.speakWithBrowser(text, voice, speed).then(resolve, reject);
              return;
            }
            reject(err);
          }
        } else if (msg.type === 'error') {
          this.enableBrowserFallback(new Error(msg.message));
          this.speakWithBrowser(text, voice, speed).then(resolve, reject);
        }
      };

      this.worker!.postMessage({ type: 'generate', text, voiceId: voice, speed });
    });
  }

  /** Interrupt current speech */
  interrupt(): void {
    try {
      this.currentSource?.stop();
    } catch {
      // Source may already have finished.
    }
    this.currentSource = null;
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel();
    }
  }

  dispose(): void {
    this.interrupt();
    this.worker?.terminate();
    this.worker = null;
    this.status = { state: 'uninitialized', progress: '', error: null };
  }

  private getPeak(data: Float32Array): number {
    let peak = 0;
    for (const sample of data) {
      const value = Math.abs(sample);
      if (value > peak) peak = value;
    }
    return peak;
  }

  private async ensureAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }

  private installAudioUnlock(): void {
    if (typeof document === 'undefined') return;

    const unlock = async () => {
      try {
        await this.ensureAudioContext();
      } catch {
        // Browsers may still refuse until a stronger user gesture; speak() retries.
      }
    };

    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }

  private enableBrowserFallback(reason: unknown): boolean {
    if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
      return false;
    }

    this.worker?.terminate();
    this.worker = null;
    this.useBrowserFallback = true;
    console.warn('[TTS] using browser SpeechSynthesis fallback:', reason);
    this.setState('ready', `Browser SpeechSynthesis fallback ready (${String(reason)})`);
    return true;
  }

  private speakWithBrowser(text: string, voice: string, speed: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
        reject(new Error('Browser SpeechSynthesis is not available'));
        return;
      }

      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = Math.max(0.5, Math.min(2, speed));

      const voices = speechSynthesis.getVoices();
      utterance.voice =
        voices.find((v) => v.name === voice) ??
        voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
        null;

      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(new Error(`SpeechSynthesis failed: ${event.error}`));
      speechSynthesis.speak(utterance);
    });
  }

  private setState(state: TTSEngineState, progress: string): void {
    this.status = { state, progress, error: state === 'error' ? progress : null };
    this.onStatus?.(this.status);
  }
}

/** Singleton */
export const ttsEngine = new TTSEngine();
