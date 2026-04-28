/**
 * Speech Pipeline — Push-to-Talk UI → MediaRecorder → ASR → Intent Router.
 *
 * Flow:
 *   press mic/Q → start recording → release → stop → WebM blob
 *   → browser decode + resample to 16kHz Float32Array → WhisperASR.transcribe()
 *   → transcript → IntentRouter.route() → matched intent
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

const SAMPLE_RATE = 16000;
const MAX_RECORDING_S = 30;

export class SpeechPipeline {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private recordStartTime = 0;
  private callbacks: PipelineCallbacks;
  private transcribeFn: TranscribeFn;
  private state: PipelineState = 'idle';

  private readonly MIN_DURATION_MS = 500;

  constructor(callbacks: PipelineCallbacks, transcribeFn: TranscribeFn) {
    this.callbacks = callbacks;
    this.transcribeFn = transcribeFn;
  }

  get currentState(): PipelineState {
    return this.state;
  }

  private setState(state: PipelineState): void {
    this.state = state;
    this.callbacks.onStateChange(state);
  }

  private log(msg: string): void {
    console.log(`[Pipeline] ${msg}`);
  }

  reset(): void {
    if (this.recorder?.state === 'recording') {
      this.recorder.stop();
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.recordStartTime = 0;
    this.setState('idle');
  }

  /** Request mic permission and start recording */
  async startRecording(): Promise<boolean> {
    if (this.state !== 'idle') {
      this.log(`⚠️ startRecording ignored — state is ${this.state}`);
      return false;
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

  /** Stop recording and process audio. Returns transcript or null if too short. */
  async stopRecording(options: TranscriptionOptions = {}): Promise<string | null> {
    if (!this.recorder || this.state !== 'listening') {
      this.log(`⚠️ stopRecording ignored — state is ${this.state}`);
      return null;
    }
    this.log('⏹ stopRecording(), waiting for onstop...');

    return new Promise((resolve) => {
      this.recorder!.onstop = async () => {
        // Clean up mic stream
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
        this.log(`WebM blob: ${(blob.size / 1024).toFixed(1)}KB`);

        try {
          // Decode WebM to 16kHz mono Float32Array
          this.log('decoding audio to Float32Array...');
          const floatData = await this.decodeToFloat32(blob);
          this.log(`audio ready: ${(floatData.length / SAMPLE_RATE).toFixed(1)}s @ ${SAMPLE_RATE}Hz`);

          // whisper.cpp does not support prompt/hotwords — ignore them
          if (options.prompt || options.hotwords?.length) {
            this.log('note: prompt/hotwords are not supported by local whisper, ignoring');
          }

          // Local ASR
          const text = await this.transcribeFn(floatData, options);
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

  /** Decode WebM blob to 16kHz mono Float32Array */
  private async decodeToFloat32(webmBlob: Blob): Promise<Float32Array> {
    const audioCtx = new AudioContext();
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioCtx.close();

    // Resample to 16kHz mono via OfflineAudioContext
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
