# Scene Engine — Technology Research Report

Research date: 2026-04-26. Version and pricing notes in this historical document reflect that date and should be revalidated before production decisions.

## 1. Three.js and Voxel/Chunk Rendering

### 1.1 Version baseline

The prototype research used Three.js 0.184 as its baseline.

Key capabilities relevant to this project:

- **WebGPU renderer:** available as a future performance path on supported modern browsers.
- **Three.js Shading Language (TSL):** a declarative shader system available through the TSL package path.
- **InstancedMesh:** mature instance rendering for many repeated block objects.
- **BufferGeometryUtils.mergeGeometries():** useful for combining static geometry and reducing draw calls.
- **Zero runtime framework dependency:** Three.js is a focused graphics library rather than a full game engine.

### 1.2 Recommended rendering model

The educational scenes in HiKid.Fun are compact indoor or semi-open spaces rather than large open worlds. Most geometry is static and only a small number of NPCs or interactable objects need independent transforms.

Recommended structure:

```text
Scene
├── Static terrain
│   ├── floor blocks
│   ├── wall blocks
│   └── furniture/props
├── Dynamic entities
│   ├── NPCs
│   └── interactable/collectible objects
└── Lightweight visual overlays
```

Priority optimizations:

1. Reuse a shared `BoxGeometry` and render repeated blocks with `InstancedMesh` or merged geometry.
2. Do not generate internal faces between adjacent solid blocks when a custom chunk builder is used.
3. Use a texture atlas if the project later depends on many block textures.
4. Keep NPCs and interactive markers as independent objects.
5. Consider WebGPU only after WebGL performance has been measured on target devices.

For V1-sized educational scenes below roughly one thousand blocks, advanced greedy meshing is not required before measurement shows a need.

### 1.3 Performance expectations

Historical planning targets:

| Scene scale | Rendering approach | Expected result |
|---|---|---|
| Small restaurant (~500 blocks) | instancing/merged static geometry | Smooth desktop rendering |
| Clinic (~800 blocks) | instancing/merged static geometry | Smooth desktop rendering |
| School corridor (~2,000 blocks) | merged/instanced geometry + culling | Requires measurement but expected to remain practical |
| Larger plaza (~5,000 blocks) | culling + batching | Requires deliberate optimization |
| iPad | simplified materials + batching | Must be benchmarked on actual hardware |

The final project should use measured frame time rather than these historical estimates as the source of truth.

## 2. GLM-ASR Integration Research

### 2.1 Historical provider baseline

The original architecture evaluated Zhipu GLM-ASR for child speech recognition through a backend proxy.

Research assumptions at the time included:

- audio upload through a server-side proxy;
- WAV-compatible audio processing;
- short push-to-talk utterances rather than continuous listening;
- possible streaming support depending on provider API mode;
- English and Chinese recognition capability.

### 2.2 Integration architecture

```text
Browser microphone
  → MediaRecorder / audio preprocessing
  → backend ASR proxy
  → provider ASR API
  → transcript
  → browser runtime
  → intent/tutor analysis
```

Provider credentials must remain on the server.

Example browser capture constraints considered in the research:

```ts
{
  sampleRate: 16000,
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
}
```

Actual browser support for a requested sample rate varies, so production code must inspect or convert the captured format instead of assuming the browser honors every constraint.

### 2.3 Primary risk: child-English accuracy

The largest unresolved risk was recognition quality for children ages 6–12 speaking English as a second language. Adult benchmark numbers are not sufficient evidence for this audience.

Recommended gating test:

1. Collect at least 50 representative short English utterances from the target age range with appropriate consent and privacy handling.
2. Include accents, hesitation, incomplete grammar, and realistic microphone conditions.
3. Compare transcript word-error rate and, more importantly, downstream semantic-task success.
4. Test latency from end-of-speech to usable transcript.
5. Replace the ASR path if semantic success is below the learning experience threshold.

The current product later moved toward browser-local ASR for privacy and cost control; this historical cloud-ASR research remains useful as a benchmark reference.

## 3. Kitten TTS Browser Research

### 3.1 Historical model baseline

The original browser experiment evaluated Kitten TTS Nano v0.1 and an ONNX/WebAssembly pipeline.

Historical properties considered:

- small neural TTS model;
- multiple English voices;
- adjustable speaking rate;
- local browser inference through ONNX Runtime Web;
- optional WebGPU acceleration with WASM fallback;
- model and runtime assets cached in the browser after first load.

### 3.2 Browser architecture explored

```text
English text
  → text cleanup
  → phonemization
  → tokenization
  → ONNX inference in Web Worker
  → waveform
  → Web Audio playback
```

A worker is important because model initialization and inference can block the UI/render loop if executed on the main thread.

### 3.3 Vite considerations

The research identified several build concerns:

- deploy ONNX Runtime Web WASM files as static assets;
- ensure worker modules are emitted correctly;
- avoid unsupported transformations of ONNX/WASM runtime paths;
- use a modern browser target;
- cache large model assets after first download.

### 3.4 TTS risks

| Risk | Why it matters | Validation |
|---|---|---|
| Voice naturalness | Children disengage from robotic or unnatural speech | Listen with target users and native-English reviewers |
| Voice variety | Different NPCs benefit from distinguishable voices | Compare available voices before adding custom work |
| First-load size | Model/runtime assets can delay the first session | Measure on iPad/mobile networks and cache aggressively |
| Mobile/browser compatibility | WASM/WebGPU support and memory differ by device | Test on real Safari/iPad hardware |
| Pronunciation consistency | English-learning content requires reliable native-like output | Create a vocabulary/sentence benchmark set |

The project later switched its main Kitten TTS integration to a server-side `kitten-tts-server` path. See the historical integration solution document for details.

## 4. DeepSeek Intent-Routing Research

### 4.1 Use case

The intent router receives:

```text
ASR transcript
+ conversation context
+ candidate semantic intents
→ LLM
→ matched intent or none
```

The design intentionally uses semantic intent descriptions instead of rigid phrase matching because child speech can contain grammar errors, omissions, and alternative wording while still expressing the correct meaning.

### 4.2 Structured output

Conceptual response:

```ts
interface IntentResult {
  intent: string | null;
  confidence: number;
  reasoning?: string;
}
```

Recommended generation settings:

- low temperature for consistency;
- structured JSON output when supported;
- short output budget;
- server-side schema validation;
- no direct model control over game state.

The runtime must treat the model result as an interpretation proposal. Game/task truth remains controlled by deterministic application code.

### 4.3 Fallback strategy

Provider failures must not trap a child.

```text
LLM available
  → semantic intent classification
LLM unavailable / timed out
  → local keyword/rule fallback
Repeated provider failures
  → temporary circuit breaker
Still unresolved
  → supportive retry/scaffold or controlled task continuation
```

A simple local matcher can score expected keywords and produce a deliberately lower confidence. It should be used as a fallback rather than pretending to provide the same semantic coverage as an LLM.

### 4.4 Cost and latency

The historical research found classification requests small enough to be inexpensive compared with generation-heavy workloads, but provider pricing is unstable. Current cost decisions must use current provider pricing and measured token counts rather than figures captured in April 2026.

For a child-facing push-to-talk flow, end-to-end latency matters more than raw model throughput. Measure P50/P95 from speech release to useful feedback.

## 5. TypeScript Project Structure

Recommended high-level organization:

```text
src/
├── main.ts
├── engine/
│   ├── renderer/
│   ├── runtime/
│   ├── voice/
│   ├── scoring/
│   └── schema/
├── scenes/
└── portal/
server/
├── src/
│   ├── routes/
│   └── utils/
└── data/
tests/
└── headless/
```

Scene schema should strongly type NPCs, dialogue, tasks, map coordinates, target vocabulary, CEFR metadata, and the small explicit hook surface.

Example concepts:

```ts
interface VoiceConfig {
  voice: string;
  speed: number;
}

interface DialogueNode {
  npcText: string;
  candidateIntents: CandidateIntentDef[];
  hintExamples: string[];
  timeoutMs?: number;
}

interface CandidateIntentDef {
  intent: string;
  description: string;
  nextNode: string;
  score: number;
}

interface NPCConfig {
  position: [number, number, number];
  appearance: string;
  startNode: string;
  interactRadius: number;
  voice: VoiceConfig;
}

interface TaskConfig {
  targetIntent: string;
  scoreReward: number;
}
```

## 6. Vite vs. Webpack

The research recommended **Vite** for this project.

| Dimension | Vite | Webpack |
|---|---|---|
| Development | Native ESM and fast HMR | Mature but more bundling overhead |
| Web Workers | First-class modern pattern | Supported with more configuration history |
| TypeScript | Simple transpilation workflow | Usually requires additional loader configuration |
| Three.js ESM | Natural fit | Supported |
| WASM/static assets | Straightforward | Supported but often more configuration-heavy |
| Configuration size | Small | Usually larger |

Reasons for Vite:

1. Fast iteration is valuable while tuning 3D scene geometry and interaction.
2. Three.js uses modern ES modules naturally.
3. Worker and static-asset patterns are simple.
4. The original TTS browser references also used a Vite-style toolchain.
5. Project complexity does not justify Webpack-specific features such as Module Federation.

Reconsider Webpack only if a later product requirement depends on a capability that materially outweighs migration cost.

## 7. Architecture Summary

Historical recommended shape:

```text
Rendering: Three.js in browser
Scene rules: typed declarative config + small explicit hooks
Session lifecycle: XState/runtime logic
Speech input: push-to-talk ASR
Intent meaning: LLM with local fallback
Speech output: replaceable TTS provider/path
Scoring: deterministic application logic
Build: Vite + TypeScript
Secrets: server-side only
```

Current EngKid architecture should preserve the most important principle from this research:

**AI interprets language; deterministic tutor/game code owns progression and truth.**

## 8. Validation Backlog

| Priority | Question | Validation |
|---|---|---|
| P0 | How accurately does ASR understand 6–12-year-old L2 English? | Representative child-speech benchmark |
| P0 | Is the selected TTS voice natural enough for English learning? | Native-English review + child user testing |
| P0 | Does the engine-as-constraint-layer model work? | Build and test a complete hard-coded scene |
| P1 | What is semantic-routing latency and accuracy? | Logged benchmark with realistic utterances |
| P1 | How much scene behavior is declarative vs. hooks? | Build several materially different scenes |
| P1 | Which schema form is easiest for AI generation and validation? | Compare TypeScript/JSON-schema authoring flows |
| P2 | How does Three.js + voice processing perform on iPad? | Real-device profiling |
| P2 | Is a richer hook DSL needed? | Delay until at least three real scenes expose repeated patterns |

## References

- Three.js documentation and examples: https://threejs.org/
- Three.js repository: https://github.com/mrdoob/three.js
- Kitten TTS browser reference: https://github.com/clowerweb/kitten-tts-web-demo
- XState documentation: https://stately.ai/docs/xstate
- Historical provider documentation used during the original research should be rechecked before implementation because model names, pricing, limits, and API behavior can change.
