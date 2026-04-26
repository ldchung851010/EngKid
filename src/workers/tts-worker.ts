/**
 * TTS Web Worker — Kitten TTS ONNX inference.
 *
 * Pipeline: text → clean → chunk → phonemize → tokenize → ONNX → audio
 */

let ort: any = null;
let ttsSession: any = null;
let voicesData: Record<string, number[][]> = {};
let vocab: Record<string, number> = {};

function postMsg(msg: Record<string, unknown>): void {
  (self as unknown as Worker).postMessage(msg);
}

// ── Text Cleaning ──────────────────────────────────────────────

function cleanText(text: string): string {
  return text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/[""']/g, '')
    .replace(/[^\u0000-\u024F\s.,!?]/g, '')
    .trim();
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const trimmed = s.trim();
    if (trimmed) chunks.push(trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?') ? trimmed : trimmed + '.');
  }
  return chunks.length > 0 ? chunks : [text];
}

// ── Tokenizer ──────────────────────────────────────────────────

async function tokenize(text: string): Promise<BigInt64Array> {
  const { phonemize } = await import('phonemizer');
  const phonemes = await phonemize(text, 'en-us');
  const chars = `$${phonemes}$`.split('');

  const ids = chars.map((ch) => {
    const id = vocab[ch];
    if (id === undefined) {
      console.warn(`[tts-worker] unknown char: "${ch}"`);
      return 0;
    }
    return id;
  });

  return BigInt64Array.from(ids.map((n) => BigInt(n)));
}

// ── Model Loading ──────────────────────────────────────────────

async function loadModel(modelPath: string): Promise<void> {
  postMsg({ type: 'progress', status: 'Loading ONNX Runtime...' });
  ort = await import('onnxruntime-web');
  ort.env.wasm.wasmPaths = '/onnx-runtime/';

  // Load tokenizer
  postMsg({ type: 'progress', status: 'Loading tokenizer...' });
  const tokResp = await fetch(`${modelPath}tokenizer.json`);
  const tokData = await tokResp.json();
  vocab = tokData.model.vocab;

  // Load voices
  postMsg({ type: 'progress', status: 'Loading voice embeddings...' });
  const voicesResp = await fetch(`${modelPath}voices.json`);
  voicesData = await voicesResp.json();

  // Load model
  postMsg({ type: 'progress', status: 'Loading TTS model (~23MB)...' });
  const modelResp = await fetch(`${modelPath}model_quantized.onnx`);
  const modelBuffer = await modelResp.arrayBuffer();

  try {
    ttsSession = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: [{ name: 'webgpu' }, 'wasm'],
    });
    postMsg({ type: 'progress', status: 'Using WebGPU backend' });
  } catch {
    ttsSession = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: ['wasm'],
    });
    postMsg({ type: 'progress', status: 'Using WASM backend' });
  }
}

// ── Speech Generation ──────────────────────────────────────────

async function generate(text: string, voiceId: string, speed: number): Promise<void> {
  if (!ttsSession) {
    postMsg({ type: 'error', message: 'Model not loaded' });
    return;
  }

  // Resolve voice
  let voiceEmb = voicesData[voiceId];
  if (!voiceEmb) {
    voiceEmb = Object.values(voicesData)[0];
    if (!voiceEmb) { postMsg({ type: 'error', message: 'No voices' }); return; }
  }
  const style = new Float32Array(voiceEmb[0]); // inner 256-dim vector

  try {
    // Clean + chunk text
    const cleaned = cleanText(text);
    const chunks = chunkText(cleaned);

    postMsg({ type: 'progress', status: `Generating ${chunks.length} chunk(s)...` });

    const audioChunks: Float32Array[] = [];
    const sampleRate = 24000;

    for (const chunk of chunks) {
      const tokenIds = await tokenize(chunk);
      const feeds: Record<string, any> = {
        input_ids: new ort.Tensor('int64', tokenIds, [1, tokenIds.length]),
        style: new ort.Tensor('float32', style, [1, style.length]),
        speed: new ort.Tensor('float32', new Float32Array([speed]), [1]),
      };

      const results = await ttsSession.run(feeds);
      let audioData = new Float32Array(results.waveform.data);

      // Fix NaN values
      let maxAmp = 0;
      for (let i = 0; i < audioData.length; i++) {
        if (isNaN(audioData[i])) audioData[i] = 0;
        if (Math.abs(audioData[i]) > maxAmp) maxAmp = Math.abs(audioData[i]);
      }

      // Normalize if too quiet
      if (maxAmp > 0 && maxAmp < 0.1) {
        const factor = 0.5 / maxAmp;
        for (let i = 0; i < audioData.length; i++) audioData[i] *= factor;
      }

      // Speed adjustment via simple resampling
      if (speed !== 1.0) {
        const newLen = Math.floor(audioData.length / speed);
        const stretched = new Float32Array(newLen);
        for (let i = 0; i < newLen; i++) {
          stretched[i] = audioData[Math.min(Math.floor(i * speed), audioData.length - 1)];
        }
        audioData = stretched;
      }

      audioChunks.push(audioData);
    }

    // Merge all chunks
    if (audioChunks.length === 0) {
      postMsg({ type: 'error', message: 'No audio generated' });
      return;
    }

    const totalLen = audioChunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const chunk of audioChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Normalize peaks
    let peak = 0;
    for (let i = 0; i < merged.length; i++) {
      if (Math.abs(merged[i]) > peak) peak = Math.abs(merged[i]);
    }
    if (peak > 0) {
      const gain = Math.min(4, 0.9 / peak);
      for (let i = 0; i < merged.length; i++) merged[i] *= gain;
    }

    postMsg({ type: 'audio', data: merged, sampleRate });
  } catch (err) {
    postMsg({ type: 'error', message: String(err) });
  }
}

// ── Message Handler ────────────────────────────────────────────

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      await loadModel(msg.modelPath);
      postMsg({ type: 'ready' });
    } else if (msg.type === 'generate') {
      await generate(msg.text, msg.voiceId, msg.speed);
    }
  } catch (err) {
    postMsg({ type: 'error', message: String(err) });
  }
};
