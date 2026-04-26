/**
 * TTS Web Worker — Kitten TTS ONNX inference.
 *
 * Loads the Kitten TTS ONNX model and generates speech audio
 * on demand, off the main thread.
 *
 * Model: KittenML/kitten-tts-nano-0.1 (HuggingFace)
 * Files: model_quantized.onnx, voices.json
 */

// Using 'any' for onnxruntime types since this runs in a Worker context
let ort: any = null;
let ttsSession: any = null;
let voices: Record<string, Float32Array> = {};

function postMsg(msg: Record<string, unknown>): void {
  (self as unknown as Worker).postMessage(msg);
}

async function loadModel(modelPath: string): Promise<void> {
  postMsg({ type: 'progress', status: 'Loading ONNX Runtime...' });

  ort = await import('onnxruntime-web');

  postMsg({ type: 'progress', status: 'Loading voice embeddings...' });

  const voicesResp = await fetch(`${modelPath}voices.json`);
  const voicesData = await voicesResp.json();
  for (const [key, embedding] of Object.entries(voicesData)) {
    voices[key] = new Float32Array(embedding as number[]);
  }

  postMsg({ type: 'progress', status: `Loading TTS model (~24MB)...` });

  const modelResp = await fetch(`${modelPath}model_quantized.onnx`);
  const modelBuffer = await modelResp.arrayBuffer();

  // Try WebGPU first, fallback to WASM
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

  postMsg({ type: 'progress', status: 'TTS model loaded' });
}

async function generate(text: string, voiceId: string, speed: number): Promise<void> {
  if (!ttsSession || !ort) {
    postMsg({ type: 'error', message: 'Model not loaded' });
    return;
  }

  // Resolve voice
  let voice = voices[voiceId];
  if (!voice) {
    const firstKey = Object.keys(voices)[0];
    if (!firstKey) {
      postMsg({ type: 'error', message: 'No voices available' });
      return;
    }
    voice = voices[firstKey];
  }

  try {
    postMsg({ type: 'progress', status: 'Generating speech...' });

    const encoder = new TextEncoder();
    const inputBytes = encoder.encode(text.toLowerCase());
    const inputIds = BigInt64Array.from(Array.from(inputBytes, (n) => BigInt(n)));

    const feeds: Record<string, any> = {
      input_ids: new ort.Tensor('int64', inputIds, [1, inputBytes.length]),
      voice_embedding: new ort.Tensor('float32', voice, [1, voice.length]),
      speed: new ort.Tensor('float32', new Float32Array([speed]), [1]),
    };

    const results = await ttsSession.run(feeds);
    const audioData = new Float32Array(results.audio.data);

    postMsg({
      type: 'audio',
      data: audioData,
      sampleRate: 24000,
    });
  } catch (err) {
    postMsg({ type: 'error', message: `Generation failed: ${String(err)}` });
  }
}

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
