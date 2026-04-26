/**
 * Speech Pipeline — Push-to-Talk UI → MediaRecorder → ASR → Intent Router.
 *
 * Flow:
 *   press mic → start recording → release → stop → WebM blob
 *   → Mediabunny WAV conversion → POST /api/asr → transcript
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

  /** Request mic permission and start recording */
  async startRecording(): Promise<void> {
    if (this.state !== 'idle') return;

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

      this.recorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: 16000,
      });

      this.chunks = [];
      this.recorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      this.recorder.start();
      this.recordStartTime = Date.now();
      this.setState('listening');
    } catch (err) {
      this.setState('error');
      throw err;
    }
  }

  /** Stop recording and process audio. Returns transcript or null if too short. */
  async stopRecording(): Promise<string | null> {
    if (!this.recorder || this.state !== 'listening') return null;

    return new Promise((resolve) => {
      this.recorder!.onstop = async () => {
        // Clean up mic stream
        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = null;
        this.recorder = null;

        const duration = Date.now() - this.recordStartTime;
        if (duration < this.MIN_DURATION_MS || this.chunks.length === 0) {
          this.setState('idle');
          resolve(null);
          return;
        }

        this.setState('transcribing');

        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        try {
          // Convert WebM → WAV via Mediabunny (browser-side)
          const wav = await this.convertToWav(blob);

          // Send to ASR backend proxy
          const formData = new FormData();
          formData.append('file', wav, 'recording.wav');

          const response = await fetch('/api/asr', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`ASR failed: ${response.status}`);
          }

          const data = await response.json();
          const text = data.text ?? '';
          this.callbacks.onTranscript(text);
          resolve(text);
        } catch {
          this.setState('error');
          resolve('');
        }
      };

      this.recorder!.stop();
    });
  }

  /**
   * Convert WebM audio blob to WAV format using Mediabunny.
   * If Mediabunny is not available, sends WebM directly and relies
   * on the server to handle conversion.
   */
  private async convertToWav(_webmBlob: Blob): Promise<Blob> {
    // Mediabunny integration placeholder — for V1, pass WebM through
    // and handle conversion server-side or via AudioContext.decode + WAV encode
    //
    // Production path:
    //   const audioCtx = new AudioContext({ sampleRate: 16000 });
    //   const buffer = await audioCtx.decodeAudioData(await webmBlob.arrayBuffer());
    //   return encodeWAV(buffer); // custom WAV encoder
    //
    // For now, return the original blob. GLM-ASR-2512 accepts webm for some
    // endpoints, or the server proxy handles conversion.

    // Quick client-side WAV conversion via AudioContext
    try {
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const arrayBuffer = await _webmBlob.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const wavBlob = this.encodeWAV(audioBuffer);
      audioCtx.close();
      return wavBlob;
    } catch {
      // Fallback: return original, server handles it
      return _webmBlob;
    }
  }

  /** Simple WAV encoder (PCM 16-bit, mono) */
  private encodeWAV(audioBuffer: AudioBuffer): Blob {
    const numChannels = 1;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitsPerSample = 16;

    const data = audioBuffer.getChannelData(0);
    const dataLength = data.length * (bitsPerSample / 8);
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // RIFF header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, 'WAVE');

    // fmt chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);

    // data chunk
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
