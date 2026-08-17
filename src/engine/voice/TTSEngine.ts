/**
 * TTS Engine — prefers server-side Kitten TTS and falls back to the browser
 * speech synthesis API on static hosts such as GitHub Pages.
 */

export type TTSEngineState = 'idle' | 'loading' | 'ready' | 'error';

export interface TTSEngineStatus {
  state: TTSEngineState;
  progress: string;
  error: string | null;
}

type StatusCallback = (status: TTSEngineStatus) => void;

export class TTSEngine {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private status: TTSEngineStatus = { state: 'idle', progress: '', error: null };
  private onStatus: StatusCallback | null = null;
  private browserFallback = false;

  onStatusChange(cb: StatusCallback): void {
    this.onStatus = cb;
    cb(this.status);
  }

  /**
   * Prefer the HiKid backend when available. On GitHub Pages there is no
   * native Kitten TTS server, so use Safari/browser voices instead.
   */
  async init(): Promise<void> {
    this.setState('loading', 'Checking voice service...');

    const isStaticHost = location.hostname.endsWith('github.io');
    const deadline = Date.now() + (isStaticHost ? 1200 : 15000);

    while (Date.now() < deadline) {
      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 1000);
        const res = await fetch('/api/health', { signal: controller.signal });
        window.clearTimeout(timeout);
        if (res.ok) {
          this.browserFallback = false;
          this.setState('ready', 'TTS server ready');
          return;
        }
      } catch {
        // Backend may still be starting locally; keep trying until deadline.
      }
      await new Promise((r) => setTimeout(r, isStaticHost ? 100 : 500));
    }

    if ('speechSynthesis' in window) {
      this.browserFallback = true;
      this.setState('ready', 'Browser English voice ready');
      return;
    }

    this.setState('error', 'No speech synthesis service available');
    throw new Error('No speech synthesis service available');
  }

  /** Speak text with Kitten TTS when available, otherwise Safari/browser TTS. */
  async speak(text: string, voice: string, speed = 1.0): Promise<void> {
    if (this.status.state !== 'ready') {
      throw new Error('TTS engine not ready');
    }

    if (this.browserFallback) {
      await this.speakWithBrowser(text, speed);
      return;
    }

    const start = Date.now();
    console.log(`[TTS] → fetch: "${text.substring(0, 40)}..."`);

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text, voice, speed }),
    });

    if (!res.ok) {
      // A backend can disappear after startup. Keep the lesson playable.
      if ('speechSynthesis' in window) {
        this.browserFallback = true;
        this.setState('ready', 'Browser English voice ready');
        await this.speakWithBrowser(text, speed);
        return;
      }

      let error = `TTS request failed: ${res.status}`;
      if (res.status === 429) error = 'Voice quota is used up for now.';
      throw new Error(error);
    }

    console.log(`[TTS] ← ${res.headers.get('content-length') || '?'} bytes in ${Date.now() - start}ms`);

    const audioContext = await this.ensureAudioContext();
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const source = audioContext.createBufferSource();
    this.currentSource = source;
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    return new Promise((resolve) => {
      source.onended = () => {
        if (this.currentSource === source) this.currentSource = null;
        resolve();
      };
      source.start();
    });
  }

  /** Interrupt current speech. */
  interrupt(): void {
    try { this.currentSource?.stop(); } catch { /* already stopped */ }
    this.currentSource = null;
    if (this.browserFallback && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  dispose(): void {
    this.interrupt();
    this.audioContext?.close();
    this.audioContext = null;
  }

  private async speakWithBrowser(text: string, speed: number): Promise<void> {
    if (!('speechSynthesis' in window)) throw new Error('Browser TTS unavailable');

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = Math.max(0.65, Math.min(1.2, speed));

    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /en-US/i.test(v.lang) && /Samantha|Ava|Allison|Susan|Aaron|Alex/i.test(v.name)) ??
      voices.find((v) => /en-US/i.test(v.lang)) ??
      voices.find((v) => /^en/i.test(v.lang));
    if (preferred) utterance.voice = preferred;

    await new Promise<void>((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(new Error(`Browser TTS failed: ${event.error}`));
      window.speechSynthesis.speak(utterance);
    });
  }

  private async ensureAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) this.audioContext = new AudioContext();
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();
    return this.audioContext;
  }

  private setState(state: TTSEngineState, progress: string): void {
    this.status = { state, progress, error: state === 'error' ? progress : null };
    this.onStatus?.(this.status);
  }
}
