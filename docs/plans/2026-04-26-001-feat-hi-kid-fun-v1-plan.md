---
title: feat: Build hi-kid-fun — Three.js voxel English learning engine
type: feat
status: active
date: 2026-04-26
origin: docs/brainstorms/2026-04-26-hi-kid-fun-requirements.md
---

# HiKid.Fun — V1 Implementation Plan

## Overview

Build a Three.js voxel scene engine that gives children ages 6–12 an immersive English-speaking experience. The engine encapsulates rendering, the voice pipeline, intent routing, scoring, and the session lifecycle. Human or AI scene authors define new scenes through declarative configuration.

The V1 goal is to run one hard-coded restaurant scene end to end and validate the core model: **the engine acts as a constraint layer for reliable learning scenes**.

---

## Problem Frame

Many children's English apps have weak retention, while offline classes provide too little speaking time. A voxel 3D world can host practical English situations where children explore freely and use Push-to-Talk to speak with NPCs. The engine supplies a structured grammar and scene constraint layer so new AI-generated scenes remain predictable and testable.

---

## Requirements Trace

- R1. Minecraft-style voxel 3D world with free first- or third-person camera movement.
- R2. Atomic block types for terrain, props, and NPC entities.
- R3. Session state machine: `idle → active → task-in-progress → task-complete → session-end`.
- R4. Scene loading, unloading, and switching while preserving scoring context where required.
- R5. TTS speech synthesis with an offline browser-capable Kitten TTS path.
- R6. Push-to-Talk ASR using GLM-ASR-2512 through a backend proxy.
- R7. Intent router: ASR transcript + context + candidate intents → LLM → intent match.
- R8. LLM degradation path using keyword/rule fallback; for `none`, guide the learner and retry up to three times.
- R9. Score dimensions include task completion, attempts, and target-language usage.
- R10. Session-scoped scoring with a final session score.
- R11. Scene = declarative configuration + optional hooks.
- R12. Schema validation rejects invalid configuration with field-level errors.
- R13. NPC definitions include position, appearance, dialogue tree, voice, and interaction trigger.
- R14. Task definitions include trigger, target intent, success criteria, and score reward.
- R15. V1 uses only 2–3 explicit function hooks; a hook DSL is deferred.
- R16. Full validation occurs during scene loading and reports the failing path.
- R17. Scene API: `register()`, `activate()`, `getActiveScene()`.
- R18. Headless mode validates scene configuration and dialogue logic without WebGL.
- R19. Show 2–3 example utterance bubbles near the microphone control.

**Actors:** child learner, scene author/teacher, AI scene generator.  
**Primary flows:** learning session, scene definition, AI scene generation.  
**Acceptance examples:** complete restaurant interaction, invalid-schema rejection, session-state transitions, and a second NPC/task scene definition.

---

## Scope Boundaries

### Deferred

- Multiplayer and peer conversation.
- NPC lip sync and expression synchronization.
- AR/VR support.
- Scene marketplace/community sharing.
- Parent/teacher analytics dashboard.
- Course sequencing.
- Greedy-meshing optimization.
- Dedicated mobile compatibility work.
- Teacher self-service scene-authoring tools.
- Hook DSL until multiple scenes prove the need.

### Outside the product identity

- A general-purpose game engine with full physics, particles, and skeletal animation.
- A course-management system.
- A pronunciation-assessment platform with phoneme-by-phoneme grading.

---

## Technology Stack

| Layer | Choice | Deployment |
|---|---|---|
| Rendering | Three.js + InstancedMesh | Browser |
| TTS | Kitten TTS / ONNX path | Browser or local service depending on deployment |
| ASR | GLM-ASR-2512 | Cloud through backend proxy |
| Intent LLM | DeepSeek-compatible chat API | Cloud through backend proxy |
| State machine | XState v5 | Browser |
| Build | Vite + TypeScript | Browser build |
| Backend proxy | TypeScript server | Node.js |

### Voxel rendering pattern

V1 uses a single configurable chunk, capped around 32×16×32, with one `InstancedMesh` per block type. Blocks share `BoxGeometry`; instances are placed with `setMatrixAt()`. Only visible external faces are needed. NPCs remain separate mesh objects because they need independent movement and rotation.

### Voice pipeline

```text
Push-to-Talk
  → MediaRecorder
  → audio blob
  → backend ASR proxy
  → transcript
  → backend intent proxy
  → { intentId, confidence }
  → dialogue/state progression
  → NPC text
  → TTS
  → audio playback
```

API keys remain server-side.

---

## Target Repository Structure

```text
hi-kid-fun/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       └── routes/
│           ├── asr.ts
│           └── intent.ts
├── src/
│   ├── index.ts
│   ├── engine/
│   │   ├── runtime/
│   │   │   ├── SessionMachine.ts
│   │   │   └── SceneLoader.ts
│   │   ├── renderer/
│   │   │   ├── VoxelWorld.ts
│   │   │   ├── ChunkBuilder.ts
│   │   │   ├── BlockTypes.ts
│   │   │   └── CameraController.ts
│   │   ├── voice/
│   │   │   ├── TTSEngine.ts
│   │   │   ├── SpeechPipeline.ts
│   │   │   ├── IntentRouter.ts
│   │   │   └── MicButton.ts
│   │   ├── scoring/ScoreTracker.ts
│   │   └── schema/
│   │       ├── SceneConfig.ts
│   │       └── ConfigValidator.ts
│   └── scenes/restaurant/
│       ├── config.ts
│       └── hooks.ts
└── tests/
    └── headless/
```

---

## Key Technical Decisions

- **InstancedMesh over merged geometry:** one draw call per block type is sufficient for V1; greedy meshing can wait.
- **Vite over Webpack:** simple TypeScript/WASM/worker integration and fast iteration.
- **Backend proxy over direct provider calls:** protects ASR and LLM credentials.
- **XState over a hand-written complex state machine:** explicit transitions reduce impossible states and improve testability.
- **TypeScript-first scene schema:** keep scene configuration typed and validate it at runtime.
- **Worker/background TTS where practical:** avoid blocking rendering during speech inference.
- **Push-to-Talk over continuous listening:** gives children clear control, reduces accidental activation, and is more privacy-friendly.

---

## Implementation Units

### Phase 1 — Foundation

#### U1. Project scaffold

Create the Vite + strict TypeScript project, initialize Three.js, configure the frontend/backend development flow, and provide placeholder canvas, mic, and score UI.

**Verification:** frontend dev server renders; Three.js scene initializes; backend health endpoint responds.

#### U2. Voxel world renderer

Create `VoxelWorld`, `ChunkBuilder`, `BlockTypes`, and `CameraController`.

Core behavior:
- Define V1 blocks such as floor, wall, table, chair, counter, and air.
- Build visible block instances by type.
- Keep NPC coordinates as air in the voxel grid and render NPCs separately.
- Support camera movement and simple collision with solid blocks.

**Headless/render checks:** all-air world, one-block world, and dense small test map must not crash and must produce expected visible geometry.

#### U3. Scene schema + validation

Define typed scene configuration:

```ts
interface SceneConfig {
  schemaVersion: '1.0';
  name: string;
  description: string;
  cefrLevel: 'A1' | 'A2';
  targetVocabulary: string[];
  map: MapConfig;
  npcs: NPCConfig[];
  tasks: TaskConfig[];
}
```

Runtime validation must return precise paths such as `/npcs/0/position`. Valid scenes pass; missing required fields, unsupported schema versions, and invalid CEFR values fail clearly.

---

### Phase 2 — Voice & Intent

#### U4. TTS engine

Provide text-to-speech for NPC dialogue. The original V1 design used a Kitten TTS WebAssembly/worker path, with model loading separated from the main UI thread and `speak()`/`interrupt()` as the primary interface.

**Verification:** synthesize a short English sentence, play it, and verify interruption behavior.

#### U5. Push-to-Talk → ASR → intent routing

The speech pipeline must:
- Start recording on user action.
- Ignore recordings that are too short.
- Send supported audio to the backend ASR endpoint.
- Route the returned transcript against candidate intents.
- Expose clear states such as `idle`, `listening`, `transcribing`, and `routing`.

The intent router should use low-temperature structured output and retain a local keyword/rule fallback. If intent remains unclear, the NPC gives a progressively clearer prompt; after the retry budget is exhausted, demonstrate an acceptable answer and continue with reduced scoring rather than trapping the child.

**Quality gate:** benchmark child-English ASR before depending on it for later units. If word-error rate is unacceptable, replace the ASR provider/path before continuing.

---

### Phase 3 — Runtime, scoring, and V1 scene

#### U6. Session lifecycle + scoring

Use XState for explicit session transitions and a session-scoped score tracker.

Example runtime context:

```ts
{
  sceneId,
  score,
  completedTasks,
  activeTaskId,
  dialogueRetries,
  conversationHistory,
  sceneFlags
}
```

Use direct explicit hook functions in V1 rather than an EventBus abstraction. Score task completion using base reward, confidence, degradation state, attempts, and target-language usage.

Headless tests should cover the normal flow, three failed intent attempts, duplicate task triggers, session reset, and scene changes.

#### U7. Restaurant scene + full integration

The V1 restaurant should contain a compact indoor map, waiter NPC, dialogue tree, an `order_food` task, mic hints, and terminal success feedback.

Example dialogue:

```text
Waiter: "Welcome! What would you like to order?"
Hints: "I'd like a hamburger." / "Can I have pizza?" / "A salad, please."
Child: meaningful food-order utterance
Waiter: confirms the order
Task completes and score increases
```

`SceneLoader` validates the config, builds the world, places NPCs, and starts the session runtime. `MicButton` binds user input and shows contextual example bubbles.

**End-to-end acceptance:**
1. Open the restaurant scene.
2. Walk near the waiter.
3. Hear the prompt.
4. Hold/tap the speaking control and answer.
5. Receive transcript/intent result.
6. Hear a natural NPC response.
7. Complete the task and see the score update.
8. Invalid scene configuration must fail with a precise validation error.

---

## System-Wide Impact

- Runtime orchestrates rendering, speech, intent, dialogue, and scoring.
- Speech failures degrade safely rather than breaking session state.
- Speaking controls are disabled while a request is already being processed.
- `register/activate/getActiveScene` is the primary external Scene API; internal implementation may evolve behind it.
- Headless tests cover configuration and dialogue behavior separately from WebGL.
- Credentials remain on the backend; the browser does not own provider secrets.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Child-English ASR accuracy is poor | Benchmark with representative child speech; change provider/path if quality misses the threshold. |
| TTS model startup blocks UX | Load asynchronously, show a ready/loading state, and cache model assets when possible. |
| Provider price or availability changes | Keep provider boundaries replaceable and retain local/rule fallback paths. |
| Lower-end browsers have limited WASM capability | Detect support and use a compatible fallback deployment path. |
| State-machine library APIs evolve | Pin versions and use stable APIs only. |

---

## Documentation / Operations

- `README.md`: project overview, architecture, development setup, environment configuration.
- Keep provider secrets such as `GLM_API_KEY` and `DEEPSEEK_API_KEY` in server-side environment variables.
- Document the engine's public contract and data flow so future AI-authored scenes remain constrained and testable.

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-26-hi-kid-fun-requirements.md](../brainstorms/2026-04-26-hi-kid-fun-requirements.md)
- Kitten TTS Web Demo: https://github.com/clowerweb/kitten-tts-web-demo
- Three.js InstancedMesh: https://threejs.org/docs/#api/en/objects/InstancedMesh
- XState v5: https://stately.ai/docs/xstate
