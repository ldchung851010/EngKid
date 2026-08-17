/**
 * Speech Pipeline — Push-to-Talk UI → ASR → Intent Router.
 *
 * Local/dev flow:
 *   press mic → MediaRecorder → Float32Array → WhisperASR
 *
 * Static GitHub Pages flow:
 *   press mic → Safari/Web SpeechRecognition → transcript
 *
 * The Pages fallback avoids whisper.cpp pthread requirements because GitHub
 * Pages cannot provide the COOP/COEP headers required for cross-origin
 * isolation.
 */

export type PipelineState = 'idle' | 'listening' | 'transcribing' | 'routing' | 'error';

export interface PipelineCallbacks {
  onStateChange: (state: PipelineState) => void;
  onTranscript: (text: string) => void;
}

export interface TranscriptionOptions {
  prompt?: string;
  hotwords?: string[];
}

export type TranscribeFn = (
  audioData: Float32Array,
  options?: TranscriptionOptions
) => Promise<string> | string;

type SpeechRecognitionResultLike = {
  isFinal?: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex?: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const SAMPLE_RATE = 16000;
const MAX_RECORDING_S = 30;

function getBrowserRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class SpeechPipeline {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private recordStartTime = 0;
  private callbacks: PipelineCallbacks;
  private transcribeFn: TranscribeFn;
  private cloudAsrUrl: string | undefined;
  private state: PipelineState = 'idle';
  private browserRecognition: SpeechRecognitionLike | null = null;
  private browserTranscript = '';
  private browserRecognitionError = '';

  private readonly MIN_DURATION_MS = 500;

  constructor(callbacks: PipelineCallbacks, transcribeFn: TranscribeFn, cloudAsrUrl?: string) {
    this.callbacks = callbacks;
    this.transcribeFn = transcribeFn;
    this.cloudAsrUrl = cloudAsrUrl;
  }

  get currentState(): PipelineState {
    return this.state;
  }

  private get useBrowserRecognition(): boolean {
    return location.hostname.endsWith('github.io') && getBrowserRecognitionCtor() !== null;
  }

  private setState(state: PipelineState): void {
    this.state = state;
    this.callbacks.onStateChange(state);
  }

  private log(msg: string): void {
    console.log(`[Pipeline] ${msg}`);
  }

  reset(): void {
    if (this.browserRecognition) {
      try { this.browserRecognition.abort(); } catch { /* already ended */ }
      this.browserRecognition = null;
    }
    if (this.recorder?.state === 'recording') {
      this.recorder.stop();
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.browserTranscript = '';
    this.browserRecognitionError = '';
    this.recordStartTime = 0;
    this.setState('idle');
  }

  /** Request mic permission and start recording / recognition. */
  async startRecording(): Promise<boolean> {
    if (this.state !== 'idle') {
      this.log(`⚠️ startRecording ignored — state is ${this.state}`);
      return false;
    }

    if (this.useBrowserRecognition) {
      return this.startBrowserRecognition();
    }

    this.log('🎤 requesting mic...');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.recorder = new MediaRecorder(this.stream, { mimeType, audioBitsPerSecond: 16000 });
      this.chunks = [];
      this.recorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      this.recorder.start();
      this.recordStartTime = Date.now();
      this.setState('listening');
      this.log(`recording started (mime=${mimeType})`);
      return true;
    } catch (err) {
      this.log(`❌ mic error: ${err}`);
      this.setState('error');
      throw err;
    }
  }

  /** Stop recording and process audio. */
  async stopRecording(options: TranscriptionOptions = {}): Promise<string | null> {
    if (this.useBrowserRecognition && this.browserRecognition) {
      return this.stopBrowserRecognition();
    }

    if (!this.recorder || this.state !== 'listening') {
      this.log(`⚠️ stopRecording ignored — state is ${this.state}`);
      return null;
    }
    this.log('⏹ stopRecording(), waiting for onstop...');

    return new Promise((resolve) => {
      this.recorder!.onstop = async () => {
        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = null;
        this.recorder = null;

        const duration = Date.now() - this.recordStartTime;
        this.log(`recording stopped: ${duration}ms, ${this.chunks.length} chunks`);

        if (duration < this.MIN_DURATION_MS || this.chunks.length === 0) {
          this.log(`⚠️ too short (min ${this.MIN_DURATION_MS}ms), discarding`);
          this.setState('idle');
          resolve(null);
          return;
        }

        this.setState('transcribing');
        const blob = new Blob(this.chunks, { type: 'audio/webm' });

        try {
          let text: string;
          if (this.cloudAsrUrl) {
            text = await this.transcribeCloud(blob, options);
          } else {
            const floatData = await this.decodeToFloat32(blob);
            text = await this.transcribeFn(floatData, options);
          }

          this.log(`← ASR text: "${text}"`);
          this.callbacks.onTranscript(text);
          this.setState('idle');
          resolve(text);
        } catch (err) {
          this.log(`❌ pipeline error: ${err}`);
          this.setState('idle');
          resolve('');
        } finally {
          this.chunks = [];
          this.recordStartTime = 0;
        }
      };

      this.recorder!.stop();
    });
  }

  private async startBrowserRecognition(): Promise<boolean> {
    const Recognition = getBrowserRecognitionCtor();
    if (!Recognition) return false;

    this.log('🎤 starting Safari/browser speech recognition...');
    this.browserTranscript = '';
    this.browserRecognitionError = '';
    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const start = event.resultIndex ?? 0;
      for (let i = start; i < event.results.length; i++) {
        const result = event.results[i];
        if (result?.[0]?.transcript) {
          this.browserTranscript += `${result[0].transcript} `;
        }
      }
    };
    recognition.onerror = (event) => {
      this.browserRecognitionError = event.error ?? 'recognition error';
      this.log(`browser ASR error: ${this.browserRecognitionError}`);
    };

    try {
      recognition.start();
      this.browserRecognition = recognition;
      this.recordStartTime = Date.now();
      this.setState('listening');
      return true;
    } catch (err) {
      this.browserRecognition = null;
      this.setState('error');
      throw err;
    }
  }

  private async stopBrowserRecognition(): Promise<string | null> {
    const recognition = this.browserRecognition;
    if (!recognition || this.state !== 'listening') return null;

    const duration = Date.now() - this.recordStartTime;
    if (duration < this.MIN_DURATION_MS) {
      try { recognition.abort(); } catch { /* ignore */ }
      this.browserRecognition = null;
      this.browserTranscript = '';
      this.setState('idle');
      return null;
    }

    this.setState('transcribing');
    return new Promise<string>((resolve) => {
      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        const text = this.browserTranscript.trim();
        this.browserRecognition = null;
        this.browserTranscript = '';
        this.recordStartTime = 0;
        this.log(`← browser ASR text: "${text}"`);
        if (text) this.callbacks.onTranscript(text);
        this.setState('idle');
        resolve(text);
      };

      recognition.onend = finish;
      try {
        recognition.stop();
      } catch {
        finish();
      }
      window.setTimeout(finish, 2500);
    });
  }

  /** Send audio blob to cloud ASR endpoint. */
  private async transcribeCloud(webmBlob: Blob, options: TranscriptionOptions = {}): Promise<string> {
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const wavBlob = this.encodeWAV(audioBuffer);
    audioCtx.close();

    const formData = new FormData();
    formData.append('file', wavBlob, 'recording.wav');
    if (options.prompt) formData.append('prompt', options.prompt);
    if (options.hotwords?.length) {
      for (const word of options.hotwords) formData.append('hotwords', word);
    }

    const res = await fetch(this.cloudAsrUrl!, { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Cloud ASR failed (${res.status}): ${err}`);
    }
    const data = await res.json();
    return data.text ?? '';
  }

  private encodeWAV(audioBuffer: AudioBuffer): Blob {
    const numChannels = 1;
    const sampleRate = audioBuffer.sampleRate;
    const bitsPerSample = 16;
    const data = audioBuffer.getChannelData(0);
    const dataLength = data.length * (bitsPerSample / 8);
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    let offset = 44;
    for (let i = 0; i < data.length; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  private async decodeToFloat32(webmBlob: Blob): Promise<Float32Array> {
    const audioCtx = new AudioContext();
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioCtx.close();

    const targetLength = Math.min(
      Math.ceil(audioBuffer.duration * SAMPLE_RATE),
      MAX_RECORDING_S * SAMPLE_RATE
    );
    const offline = new OfflineAudioContext(1, targetLength, SAMPLE_RATE);
    const src = offline.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(offline.destination);
    src.start(0);

    const rendered = await offline.startRendering();
    return rendered.getChannelData(0);
  }
}
