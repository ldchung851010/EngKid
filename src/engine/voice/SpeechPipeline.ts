/**
 * Speech Pipeline — Push-to-Talk UI → MediaRecorder → ASR → Intent Router.
 *
 * Flow:
 *   press mic/Q → start recording → release → stop → WebM blob
 *   → browser WAV conversion → POST /api/asr → transcript
 *   → IntentRouter.route() → matched intent
 */

export type PipelineState = 'idle' | 'listening' | 'transcribing' | 'routing' | 'error';

export interface PipelineCallbacks {
  onStateChange: (state: PipelineState) => void;
  onTranscript: (text: string) => void;
}

export class SpeechPipeline {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private recordStartTime = 0;
  private callbacks: PipelineCallbacks;
  private state: PipelineState = 'idle';

  private readonly MIN_DURATION_MS = 500;

  constructor(callbacks: PipelineCallbacks) {
    this.callbacks = callbacks;
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

  /** Request mic permission and start recording */
  async startRecording(): Promise<void> {
    if (this.state !== 'idle') {
      this.log(`⚠️ startRecording ignored — state is ${this.state}`);
      return;
    }
    this.log('🎤 requesting mic...');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
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
    } catch (err) {
      this.log(`❌ mic error: ${err}`);
      this.setState('error');
      throw err;
    }
  }

  /** Stop recording and process audio. Returns transcript or null if too short. */
  async stopRecording(): Promise<string | null> {
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
          // Convert WebM → WAV via browser AudioContext
          this.log('converting WebM → WAV...');
          const wav = await this.convertToWav(blob);
          this.log(`WAV ready: ${(wav.size / 1024).toFixed(1)}KB`);

          // Send to ASR backend proxy
          this.log('POST /api/asr...');
          const formData = new FormData();
          formData.append('file', wav, 'recording.wav');

          const response = await fetch('/api/asr', { method: 'POST', body: formData });

          if (!response.ok) {
            this.log(`❌ /api/asr returned ${response.status}`);
            throw new Error(`ASR failed: ${response.status}`);
          }

          const data = await response.json();
          const text = data.text ?? '';
          this.log(`← ASR text: "${text}"`);
          this.callbacks.onTranscript(text);
          resolve(text);
        } catch (err) {
          this.log(`❌ pipeline error: ${err}`);
          this.setState('error');
          resolve('');
        }
      };

      this.recorder!.stop();
    });
  }

  /** Convert WebM audio blob to WAV via browser AudioContext */
  private async convertToWav(webmBlob: Blob): Promise<Blob> {
    try {
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const arrayBuffer = await webmBlob.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const wavBlob = this.encodeWAV(audioBuffer);
      audioCtx.close();
      return wavBlob;
    } catch (err) {
      this.log(`⚠️ WAV conversion failed (${err}), sending raw WebM`);
      return webmBlob;
    }
  }

  /** Simple WAV encoder (PCM 16-bit, mono) */
  private encodeWAV(audioBuffer: AudioBuffer): Blob {
    const numChannels = 1;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1;
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
    view.setUint16(20, format, true);
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
}
