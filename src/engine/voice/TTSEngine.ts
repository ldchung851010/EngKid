/**
 * TTS Engine — server-side Kitten TTS via local API.
 *
 * The backend spawns kitten-tts-server (native binary) and exposes
 * POST /api/tts. This engine fetches synthesized WAV audio and plays
 * it via AudioContext — no browser-side ONNX inference needed.
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

  onStatusChange(cb: StatusCallback): void {
    this.onStatus = cb;
    cb(this.status);
  }

  /** Check if TTS server is reachable. Must succeed to proceed. */
  async init(): Promise<void> {
    this.setState('loading', 'Checking TTS server...');

    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          this.setState('ready', 'TTS server ready');
          return;
        }
      } catch { /* not ready */ }
      await new Promise((r) => setTimeout(r, 500));
    }

    this.setState('error', 'TTS server failed to start');
    throw new Error('TTS server failed to start');
  }

  /** Speak text. Fetches audio from server and plays it. */
  async speak(text: string, voice: string, speed = 1.0): Promise<void> {
    if (this.status.state !== 'ready') {
      throw new Error('TTS engine not ready');
    }

    const start = Date.now();
    console.log(`[TTS] → fetch: "${text.substring(0, 40)}..."`);

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text, voice, speed }),
    });

    if (!res.ok) {
      let error = `TTS request failed: ${res.status}`;
      if (res.status === 429) {
        error = 'Voice quota is used up for now.';
      }
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

  /** Interrupt current speech */
  interrupt(): void {
    try { this.currentSource?.stop(); } catch { /* already stopped */ }
    this.currentSource = null;
  }

  dispose(): void {
    this.interrupt();
    this.audioContext?.close();
    this.audioContext = null;
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
