---
title: Kitten TTS ONNX Web Worker integration — 7 pitfalls and fixes
date: 2026-04-26
category: integration-issues
module: voice-engine
problem_type: integration_issue
component: tooling
symptoms:
  - "Kitten TTS ONNX model loaded but produced no audio output"
  - "ONNX Runtime error: input 'style' is missing in 'feeds'"
  - "ONNX model failed to load from HuggingFace (404 on expected filenames)"
  - "Voice embeddings loaded but ONNX inference returned NaN or silent waveform"
severity: high
root_cause: incomplete_setup
resolution_type: environment_setup
tags: [kitten-tts, onnx-runtime-web, web-worker, tts, phonemizer, three-js, wasm]
---

# Kitten TTS ONNX Web Worker integration — 7 pitfalls and fixes

## Problem

Integrating Kitten TTS (ONNX model) into a browser app via Web Worker produced no audio output despite the model appearing to load successfully. Multiple silent failures occurred across model file sourcing, dependency setup, and input tensor formatting.

## Symptoms

- ONNX Runtime warning: `Some nodes were not assigned to the preferred execution providers` (benign, but alarming)
- `Error: input 'style' is missing in 'feeds'` — model expected different tensor names than supplied
- HuggingFace file download returned 404 for expected paths (`model_quantized.onnx`, `voices.json`)
- Model loaded and inference ran without errors, but produced silence (NaN or near-zero waveform)
- ONNX Runtime Web crashed because WASM files were not served

## What Didn't Work

**Attempt 1: Direct ONNX inference with raw text bytes.**
Passed `TextEncoder.encode(text)` directly as `input_ids` tensor. The model expects phoneme token IDs, not UTF-8 bytes. Inference ran but produced garbage audio.

**Attempt 2: Voice embedding as flat array.**
`voices.json` has format `{ "voice-name": [[256 floats]] }` — the inner array is the actual embedding, but `new Float32Array(embedding)` flattened the outer wrapper, producing an incorrect [1]-dim tensor instead of [256].

**Attempt 3: Using browser SpeechSynthesis as fallback.**
The TTS engine checked `isReady` before `speak()`, and `init()` always failed (Kitten TTS model not installed), so `isReady` was always `false` — the fallback was unreachable. Architectural deadlock: the fallback path was behind a gate that required the primary path to succeed.

## Solution

Seven distinct fixes, applied in this order:

### 1. Model file names on HuggingFace differ from expectations

The repo `KittenML/kitten-tts-nano-0.1` contains:
- `kitten_tts_nano_v0_1.onnx` (not `model_quantized.onnx`)
- `voices.npz` (not `voices.json` — NumPy format, requires conversion)
- `config.json` (metadata, no model data)
- **No `tokenizer.json`** — must be sourced from elsewhere

**Fix:** Use `huggingface_hub` Python library to download the actual filenames, rename ONNX file, convert `voices.npz` to JSON, and manually copy `tokenizer.json` from the working demo.

### 2. Voice embedding is nested — extract inner array

`voices.json` structure:
```json
{ "expr-voice-2-m": [[0.112, 0.021, ...256 floats...]] }
```

**Fix:**
```typescript
// ❌ Wrong — extracts the wrapper
voices[key] = new Float32Array(embedding as number[]);

// ✅ Correct — extracts the inner 256-dim vector
voices[key] = new Float32Array((embedding as number[][])[0]);
```

### 3. ONNX model input tensor names

Check model signature before coding:
```python
import onnx
model = onnx.load("model_quantized.onnx")
for inp in model.graph.input:
    print(f"  {inp.name}: {[d.dim_value for d in inp.type.tensor_type.shape.dim]}")
```

**Actual inputs:** `input_ids: [1, variable]`, `style: [1, 256]`, `speed: [1]`
**Actual output:** `waveform` (not `audio`)

**Fix:**
```typescript
const feeds = {
  input_ids: new ort.Tensor('int64', tokenIds, [1, tokenIds.length]),
  style: new ort.Tensor('float32', speakerEmbedding, [1, 256]),     // NOT voice_embedding
  speed: new ort.Tensor('float32', new Float32Array([speed]), [1]),
};
const results = await session.run(feeds);
const audioData = new Float32Array(results.waveform.data);           // NOT results.audio
```

### 4. Text pipeline: clean → chunk → phonemize → tokenize

Kitten TTS's ONNX model expects **phoneme token IDs**, not raw text bytes:

```
text → cleanTextForTTS() → chunkText() → phonemize("en-us") → "$phonemes$" → vocab lookup → BigInt64Array
```

**Dependencies required:**
```bash
npm install phonemizer
```

**Fix (in worker):**
```typescript
async function tokenize(text: string): Promise<BigInt64Array> {
  const { phonemize } = await import('phonemizer');
  const phonemes = await phonemize(text, 'en-us');
  const chars = `$${phonemes}$`.split('');
  const ids = chars.map((ch) => vocab[ch] ?? 0);
  return BigInt64Array.from(ids.map((n) => BigInt(n)));
}
```

### 5. Tokenizer file not in model repo

`tokenizer.json` is not included in the HuggingFace repo. It must be obtained from the `kitten-tts-web-demo` reference implementation (`public/tts-model/tokenizer.json`).

**Fix:** Copy from working demo: `cp kitten-tts-web-demo/public/tts-model/tokenizer.json scene-engine/public/tts-model/`

### 6. ONNX Runtime Web WASM files

ONNX Runtime Web needs its WASM binaries (`ort-wasm-simd-threaded.jsep.wasm`, `.mjs`, `ort.bundle.min.mjs`) served from a known path.

**Fix:**
```bash
cp -r kitten-tts-web-demo/public/onnx-runtime scene-engine/public/
```

And in the worker:
```typescript
ort = await import('onnxruntime-web');
ort.env.wasm.wasmPaths = '/onnx-runtime/';
```

### 7. Vite config for ONNX Runtime compatibility

The demo's `vite.config.js` strips `?import` from ONNX Runtime's internal module requests and sets `worker: { format: 'es' }`, `assetsInclude: ['**/*.wasm']`, and `build: { target: 'esnext' }`.

**Fix:**
```typescript
// vite.config.ts
export default defineConfig({
  worker: { format: 'es' },
  build: { target: 'esnext' },
  assetsInclude: ['**/*.wasm'],
  plugins: [{
    name: 'onnx-wasm-plugin',
    configureServer(server) {
      server.middlewares.use('/onnx-runtime', (req, _res, next) => {
        if (req.url?.includes('?import')) req.url = req.url.replace('?import', '');
        next();
      });
    },
  }],
});
```

## Why This Works

Kitten TTS's ONNX model is a **phoneme-level text-to-speech** model, not a raw-bytes-to-audio model. The full pipeline is:

```
English text → clean (remove emoji, normalize punctuation)
  → chunk (split into sentences)
  → phonemize (convert to IPA phonemes via phonemizer)
  → tokenize (map phoneme chars to vocab IDs)
  → ONNX inference (phoneme tokens + style embedding + speed → waveform samples)
  → post-process (NaN removal, peak normalization, speed adjustment)
  → WAV playback
```

Each of the 7 pitfalls broke a different link in this chain. The fixes restore the complete pipeline.

## Prevention

- **Verify ONNX model signatures** before coding tensor shapes and names. Use `python -c "import onnx; ..."` to inspect inputs/outputs.
- **Always inspect JSON structure** before assuming array shape — HuggingFace embeddings often use `[[data]]` nesting.
- **Copy the full file set** from working reference implementations: `tokenizer.json`, WASM runtimes, and model files. Don't assume the model repo contains everything.
- **Don't gate fallback paths behind primary-path success** — the `isReady` check made `SpeechSynthesis` unreachable. Either default to fallback, or use separate readiness flags.

## Related

- Kitten TTS Web Demo: https://github.com/clowerweb/kitten-tts-web-demo
- HuggingFace model: https://huggingface.co/KittenML/kitten-tts-nano-0.1
- ONNX Runtime Web: https://www.npmjs.com/package/onnxruntime-web
- Phonemizer: https://www.npmjs.com/package/phonemizer
