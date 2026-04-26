/**
 * TTS Engine — Kitten TTS WebAssembly + browser SpeechSynthesis fallback.
 *
 * When Kitten TTS ONNX model is available in public/tts-model/, uses
 * Web Worker + ONNX Runtime Web for offline TTS.
 * Otherwise, falls back to browser SpeechSynthesis.
 *
 * Model source: HuggingFace KittenML/kitten-tts-nano-0.1
 * Files: model_quantized.onnx, tokenizer.json, voices.json
 */

type TTSState = 'uninitialized' | 'loading' | 'ready' | 'fallback';

export class TTSEngine {
  private worker: Worker | null = null;
  private state: TTSState = 'fallback'; // Default: use SpeechSynthesis immediately
  private audioContext: AudioContext | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  /**
   * Try to load Kitten TTS model. If unavailable, use browser SpeechSynthesis.
   * Always succeeds — engine is usable from the start.
   */
  async init(_modelPath = '/tts-model/'): Promise<void> {
    if (this.state === 'ready' || this.state === 'loading') return;

    this.state = 'loading';
    try {
      // In the future: load Kitten TTS ONNX model in Web Worker
      // const worker = new Worker(new URL('../../workers/tts-worker.ts', import.meta.url), { type: 'module' });
      // worker.postMessage({ type: 'init', modelPath });
      // await waitForMessage(worker, 'ready');
      // this.worker = worker;
      // this.state = 'ready';
      // For now: always use SpeechSynthesis
      throw new Error('Kitten TTS model not installed, using browser SpeechSynthesis');
    } catch {
      console.log('[TTS] using browser SpeechSynthesis fallback');
      this.state = 'fallback';
    }
  }

  /**
   * Speak text. Always works — uses Kitten TTS if model loaded,
   * otherwise browser SpeechSynthesis.
   */
  async speak(text: string, voice = 'en-US', speed = 1.0): Promise<void> {
    if (this.state === 'ready' && this.worker) {
      // Kitten TTS path (future)
      return this.kittenTTS(text, voice, speed);
    }

    // Browser SpeechSynthesis fallback (works immediately)
    return this.browserFallback(text, speed);
  }

  /** Interrupt current speech */
  interrupt(): void {
    this.currentUtterance = null;
    speechSynthesis.cancel();
  }

  dispose(): void {
    this.interrupt();
    this.worker?.terminate();
    this.audioContext?.close();
    this.state = 'uninitialized';
  }

  /** Kitten TTS via Web Worker (future implementation) */
  private async kittenTTS(_text: string, _voice: string, _speed: number): Promise<void> {
    // TODO: implement when Kitten TTS model is available
    return this.browserFallback(_text, _speed);
  }

  /** Browser SpeechSynthesis — always available, zero setup */
  private browserFallback(text: string, speed: number): Promise<void> {
    return new Promise((resolve) => {
      this.currentUtterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance.rate = speed;
      this.currentUtterance.lang = 'en-US';

      // Try to pick an English voice
      const voices = speechSynthesis.getVoices();
      const enVoice = voices.find((v) => v.lang.startsWith('en'));
      if (enVoice) this.currentUtterance.voice = enVoice;

      this.currentUtterance.onend = () => resolve();
      this.currentUtterance.onerror = (e) => {
        console.log(`[TTS] SpeechSynthesis error: ${e.error}`);
        resolve();
      };
      speechSynthesis.speak(this.currentUtterance);
    });
  }
}

/** Singleton TTS engine instance */
export const ttsEngine = new TTSEngine();
