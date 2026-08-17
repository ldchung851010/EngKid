---
title: Kitten TTS ONNX Web Worker Integration — Seven Pitfalls and Fixes
category: integration-issues
status: historical
---

# Kitten TTS ONNX Web Worker Integration — Seven Pitfalls and Fixes

## Context

This historical note documents an earlier attempt to run Kitten TTS directly in the browser with ONNX Runtime Web and a Web Worker. The repository later moved its primary Kitten integration to the server-side `kitten-tts-server` path, but these lessons remain useful when debugging browser ONNX inference.

The original failure pattern was confusing: the model appeared to load, yet no usable audio was produced. The complete chain required correct model assets, speaker embeddings, tensor names, text preprocessing, runtime WASM files, and Vite configuration.

## Symptoms

Observed failures included:

- ONNX Runtime warning that some nodes were not assigned to the preferred execution provider;
- `Error: input 'style' is missing in 'feeds'`;
- model downloads returning 404 because filenames differed from assumptions;
- inference completing but producing NaN, near-zero, or silent waveforms;
- ONNX Runtime Web failing because required WASM assets were not deployed;
- a browser `speechSynthesis` fallback that never ran because primary-model readiness blocked the fallback path.

## Failed Attempts

### Treating raw text bytes as `input_ids`

Using `TextEncoder.encode(text)` as model input did not work. The Kitten TTS ONNX model expects **phoneme token IDs**, not UTF-8 bytes.

### Treating the voice embedding as a flat top-level array

The voice data was nested. Passing the wrapper rather than the inner embedding vector created a tensor with the wrong shape.

### Gating fallback behind primary readiness

The TTS engine checked `isReady` before `speak()`. Because primary model initialization failed, the fallback implementation was never reachable. A fallback must have an independent readiness path.

## The Seven Fixes

### 1. Use the actual model-repository filenames

The evaluated Kitten model repository did not use the filenames the first implementation assumed. Historical assets included names such as:

```text
kitten_tts_nano_v0_1.onnx
voices.npz
config.json
```

The repository also did not necessarily contain every tokenizer/runtime asset needed by the browser demo.

**Lesson:** inspect the current model repository and a known-working reference implementation before hard-coding asset names.

### 2. Extract the inner voice-embedding vector

Voice data can look conceptually like:

```json
{
  "expr-voice-2-m": [[0.112, 0.021, 0.034]]
}
```

The model expects the inner embedding vector, not the outer wrapper.

Conceptual fix:

```ts
const wrapped = voices[voiceName];
const embedding = wrapped[0];
const style = new Float32Array(embedding);
```

Always validate the expected vector length before inference.

### 3. Inspect the real ONNX model signature

Do not guess tensor names. Inspect the model directly using ONNX tooling.

The historical model expected inputs conceptually like:

```text
input_ids : [1, variable]
style     : [1, 256]
speed     : [1]
```

and returned an output named:

```text
waveform
```

Conceptual feed:

```ts
const feeds = {
  input_ids,
  style: new ort.Tensor('float32', speakerEmbedding, [1, 256]),
  speed: new ort.Tensor('float32', new Float32Array([speed]), [1]),
};

const results = await session.run(feeds);
const audioData = new Float32Array(results.waveform.data as Float32Array);
```

**Lesson:** inspect model metadata before writing integration code.

### 4. Use phonemize → tokenize, not raw text bytes

The expected text pipeline was:

```text
English text
→ clean text
→ split/chunk if needed
→ phonemize for English
→ add expected boundary markers
→ map phoneme symbols to vocabulary IDs
→ BigInt64Array / required integer tensor
→ ONNX inference
```

Skipping phonemization produces syntactically valid tensors that are semantically meaningless to the model.

### 5. Obtain the tokenizer/vocabulary asset from a working reference when absent

The evaluated model repository did not include every browser-side asset used by the reference demo. In particular, tokenizer/vocabulary information needed to be sourced from the compatible working implementation.

**Lesson:** model weights alone are not always a complete inference package. Capture a full asset manifest from a known-good demo.

### 6. Deploy ONNX Runtime Web WASM files

`onnxruntime-web` requires its runtime WASM assets to exist at paths the application can resolve. These must be included in the production static bundle or public asset directory and configured before creating inference sessions.

Example conceptual setup:

```ts
ort.env.wasm.wasmPaths = '/onnx-runtime/';
```

Exact filenames and runtime settings depend on the installed ONNX Runtime Web version.

### 7. Configure Vite for ONNX Runtime and workers

The build must preserve runtime assets and worker behavior. The historical integration needed attention to:

- WASM assets as static files;
- ES-module worker output;
- modern build targets;
- ONNX Runtime's dynamic asset/module loading behavior;
- avoiding transformations that break runtime URL resolution.

A conceptual Vite direction:

```ts
export default defineConfig({
  assetsInclude: ['**/*.wasm'],
  worker: { format: 'es' },
  build: { target: 'esnext' },
});
```

The exact configuration should follow the current ONNX Runtime Web release rather than blindly copying this historical snippet.

## Why the Pipeline Failed

Kitten TTS ONNX inference is a phoneme-level TTS pipeline, not a simple `text → model → audio` function.

The complete conceptual chain is:

```text
English text
→ normalization
→ sentence/chunk segmentation
→ phonemization
→ tokenization
→ ONNX inference with style embedding and speed
→ waveform cleanup/normalization
→ audio playback
```

Each of the seven issues interrupted a different stage of this chain.

## Prevention Checklist

### Inspect model signatures first

Use ONNX/Python tooling to print exact input/output names, dtypes, and shapes before implementing browser feeds.

### Inspect JSON/NPZ structure before assuming dimensions

Speaker embeddings and model metadata often contain wrapper dimensions. Validate lengths and shapes explicitly.

### Capture a full asset inventory from a known-working demo

A model repository may omit tokenizer files, WASM runtime files, phonemizer assets, or browser-specific glue code.

### Test one deterministic sentence end to end

Before adding multiple voices or UI integration, prove one sentence with one voice and fixed speed produces a finite, audible waveform.

### Validate waveform output

Check for:

- NaN/Infinity;
- all-zero or near-zero output;
- extreme clipping;
- unexpected sample length.

### Keep fallback independent

Do not require primary-engine readiness before calling a fallback. Model readiness and fallback readiness are separate states.

Conceptually:

```ts
if (primaryReady) {
  return speakWithPrimary(text);
}

if (browserSpeechAvailable) {
  return speakWithBrowserSpeech(text);
}

throw new Error('No TTS path is available');
```

## Current Relevance to EngKid

The active EngKid MVP does not need to revive this browser ONNX path merely because it once existed. The important reusable lessons are:

1. inspect model contracts rather than guessing;
2. treat preprocessing assets as part of the model package;
3. test on real target hardware, especially iPad Safari;
4. keep TTS behind a replaceable provider/engine interface;
5. never let fallback behavior depend on successful initialization of the failing primary path;
6. benchmark native-like English quality with the actual child-learning sentence set.

## References

- Kitten TTS model/reference repositories used during the historical experiment.
- ONNX Runtime Web documentation: https://onnxruntime.ai/docs/get-started/with-javascript/web.html
- Reference browser demo: https://github.com/clowerweb/kitten-tts-web-demo
