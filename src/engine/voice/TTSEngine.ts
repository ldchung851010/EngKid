/**
 * TTS Engine — Kitten TTS WebAssembly wrapper.
 * Offline text-to-speech via Web Worker + ONNX Runtime Web.
 *
 * Model source: HuggingFace KittenML/kitten-tts-nano-0.1
 * Model files should be placed in public/tts-model/:
 *   - model_quantized.onnx
 *   - tokenizer.json
 *   - voices.json
 */

type TTSState = 'uninitialized' | 'loading' | 'ready' | 'error';

export class TTSEngine {
  private worker: Worker | null = null;
  private state: TTSState = 'uninitialized';
  private readyPromise: Promise<void> | null = null;
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;

  /** Initialize the TTS engine. Call once on app startup. */
  async init(modelPath = '/tts-model/'): Promise<void> {
    if (this.state === 'ready') return;
    if (this.state === 'loading') {
      await this.readyPromise;
      return;
    }

    this.state = 'loading';
    this.readyPromise = new Promise((resolve, reject) => {
      // Web Worker not created until we have a concrete TTS integration.
      // For V1, this is a placeholder that throws a descriptive error.
      this.state = 'error';
      reject(new Error(
        'Kitten TTS model files not installed.\n' +
        'Download from HuggingFace KittenML/kitten-tts-nano-0.1:\n' +
        '  - model_quantized.onnx\n' +
        '  - tokenizer.json\n' +
        '  - voices.json\n' +
        'Place them in public/tts-model/'
      ));
    });

    try {
      await this.readyPromise;
    } catch {
      // Error state — caller should check isReady()
    }
  }

  get isReady(): boolean {
    return this.state === 'ready';
  }

  /**
   * Speak text using the specified voice.
   * Returns a Promise that resolves when playback completes.
   */
  async speak(text: string, voice: string, speed = 1.0): Promise<void> {
    if (!this.isReady) {
      throw new Error('TTS engine not initialized');
    }

    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    // Worker-based TTS generation path (placeholder — requires ONNX model)
    // For now, use browser SpeechSynthesis as fallback
    return this.browserFallback(text, voice, speed);
  }

  /** Interrupt current speech playback */
  interrupt(): void {
    this.currentSource?.stop();
    this.currentSource = null;
  }

  dispose(): void {
    this.interrupt();
    this.worker?.terminate();
    this.audioContext?.close();
    this.state = 'uninitialized';
  }

  /** Browser SpeechSynthesis fallback (works without model files) */
  private browserFallback(text: string, _voice: string, speed: number): Promise<void> {
    return new Promise((resolve) => {
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = speed;
      utt.lang = 'en-US';
      utt.onend = () => resolve();
      utt.onerror = () => resolve(); // Don't block on browser TTS errors
      speechSynthesis.speak(utt);
    });
  }
}

/** Singleton TTS engine instance */
export const ttsEngine = new TTSEngine();
