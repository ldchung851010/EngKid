# HiKid.Fun — Product and Engine Requirements

## Problem

Children ages 6–12 need far more meaningful English listening and speaking practice than a typical classroom schedule provides. Many language-learning apps are shallow enough that children lose interest quickly, while traditional lessons offer limited opportunities to speak spontaneously.

HiKid.Fun uses a compact voxel-style 3D world to turn practical English situations into interactive missions. Children explore, approach NPCs, listen, speak, and complete tasks. The engine's central role is not simply code reuse: it is a **constraint layer** that makes scenes created by humans or AI predictable, valid, and testable.

## Product Model

```text
Teacher / content author ─┐
                          ├─> Scene configuration
AI scene generator ───────┘      │
                                 v
                          Scene validation
                                 │
                                 v
                    ┌─────────────────────────┐
                    │       Scene Engine      │
                    │ rendering / runtime     │
                    │ voice / intent / score  │
                    └─────────────────────────┘
                                 │
                                 v
                          Child learner
```

## Actors

### A1. Child learner

A child ages 6–12 explores a 3D scene, listens to NPC English, responds by speaking, solves contextual tasks, receives immediate feedback, and earns points.

### A2. Teacher or content author

A human author defines map layout, NPCs, dialogue, target language, tasks, and scoring through declarative configuration. A very small optional hook surface handles exceptional scene-specific behavior.

### A3. AI scene generator

An LLM receives a natural-language teaching brief and produces a scene configuration that must pass the same schema validation as human-authored content. AI output is never trusted merely because it is syntactically plausible.

## Core Flows

### F1. Learning session

1. Load and validate a scene.
2. Render the voxel world and place NPCs.
3. Let the child explore freely.
4. Entering an NPC interaction range triggers an English prompt through TTS.
5. The child presses/holds the speaking control and answers.
6. ASR converts speech to text.
7. The intent/tutor layer interprets meaning using transcript + context + candidate intents.
8. Deterministic runtime logic advances dialogue/task state.
9. The scoring system records meaningful task performance.
10. The child continues exploring or ends the session and sees feedback.

Outcome: at least one complete meaningful English interaction occurs in context.

### F2. Scene definition

1. An author creates declarative map/NPC/dialogue/task configuration.
2. If needed, a small explicit hook implements exceptional logic.
3. The engine validates the configuration at load time.
4. Valid scenes run; invalid scenes return precise field/path errors.

### F3. AI-generated scene

1. An author describes a learning situation in natural language.
2. The AI generates structured scene data under the documented schema.
3. The engine validates it exactly like human-authored data.
4. Validation errors can be returned to the generator for correction.

The desired outcome is a usable scene without handwritten engine code.

## Requirements

### Voxel rendering

- **R1.** Render a Minecraft-inspired voxel 3D environment with free first- or third-person navigation.
- **R2.** Scenes use atomic block/prop types for terrain, furniture, items, and independent NPC entities.

### Session lifecycle

- **R3.** Manage explicit states such as `idle → active → task-in-progress → task-complete → session-end`.
- **R4.** Support scene load/unload/switch behavior while keeping session scoring semantics explicit.

### Voice pipeline

- **R5. TTS.** Convert arbitrary NPC/tutor English text to speech with adjustable rate and a replaceable provider/runtime path.
- **R6. ASR.** Use child-controlled push-to-talk rather than continuous listening. Short spoken responses are transcribed only after the child initiates recording.
- **R7. Intent interpretation.** Interpret the transcript with conversation context and candidate semantic intents. Scene configuration describes meaning in natural language rather than relying only on rigid phrase enums.
- **R8. Degradation.** If the language model/provider is unavailable, use a local rule/keyword fallback or a controlled retry path. If an utterance is unrelated or unclear, give friendly scaffolding instead of trapping or harshly rejecting the child. Retry budgets are finite.

### Scoring

- **R9.** Track task completion, number of attempts, and whether the child expressed the target meaning. Semantic success matters more than exact word-for-word matching.
- **R10.** Keep session scoring deterministic and display a session summary. Cross-session learner modeling belongs to the application layer rather than the low-level scene engine.

### Scene definition and constraints

- **R11.** A scene consists primarily of declarative configuration plus optional hooks.
- **R12.** The schema must be strict enough for reliable AI generation while expressive enough for realistic beginner/intermediate learning situations.
- **R13.** NPC definitions include position, appearance, dialogue, voice settings, and interaction conditions.
- **R14.** Task definitions include trigger, target meaning/intent, success criteria, and score reward.
- **R15.** V1 exposes only a few explicit function hooks. Do not design a broad hook DSL before several real scenes prove repeated patterns.
- **R16.** Validation errors identify the exact failing field/path so authors and agents can repair configuration quickly.

### Child-facing support

- **R19.** Show two or three contextual example utterances near the speaking control when useful. Younger children may use visual cues instead of text-only hints.

### Engine boundary

- **R17.** Expose a small scene API such as `register(sceneConfig)`, `activate(sceneId)`, and `getActiveScene()`.
- **R18.** Core scene, dialogue, validation, and scoring logic must run in a headless test environment without WebGL.

## Acceptance Examples

### AE1 — Restaurant speaking task

An eight-year-old approaches a waiter. The waiter says, “Welcome! What would you like to order?” The child says “I'd like a hamburger” or another semantically valid food request. ASR returns text, the language layer identifies the ordering intent, deterministic scene logic completes the task, and the score updates.

Alternative wording such as “I want pizza” should also succeed if it expresses the target meaning.

### AE2 — Invalid scene configuration

A scene contains an NPC without a required `position`. The engine refuses to start the scene and returns an error that clearly identifies the NPC and missing field.

### AE3 — Runtime transition

A child is in `task-in-progress`. Completing the target action transitions to `task-complete`, displays feedback, and allows the session to continue or end without an impossible intermediate state.

### AE4 — Different scenario, same engine

A clinic scene defines a doctor at a location, a `describe_symptom` interaction, and several response steps. The scene runs without changing renderer, speech, scoring, or core runtime code.

## Success Criteria

- An eight-year-old can enter and complete a simple scene interaction with little or no parent help.
- A non-engineer content author can define a materially different scene mostly through configuration.
- AI-generated scene configuration can be automatically validated and corrected rather than manually trusted.
- Child speaking behavior is judged primarily by meaning and communicative success.
- Engine subsystems remain testable independently from rendered WebGL output.

## Explicit Non-Goals

- multiplayer or peer-to-peer speaking;
- NPC lip sync or full skeletal animation;
- AR/VR hardware support;
- a community scene marketplace;
- parent/teacher analytics dashboards inside the engine;
- course-management sequencing beyond minimal scene metadata;
- a professional phoneme-level pronunciation assessment system;
- a general game engine with full physics, particles, animation, and arbitrary gameplay systems.

## Architecture Decisions

### Hybrid scene architecture

Use **declarative configuration + small hooks**. A pure declarative system risks an oversized schema for unusual scenarios, while an ECS/general-game architecture creates excessive complexity for an educational scene prototype.

Start with one complete scene, identify which behaviors repeat, move only repeated constraints into the engine, and keep exceptional behavior explicit.

### Semantic routing instead of rigid phrase classification

Children often produce incomplete grammar, alternative wording, hesitation, or pronunciation-driven ASR variants. Meaning should be interpreted semantically from context. Candidate intents are still constrained by scene configuration so the model does not invent game truth.

### Meaning over pronunciation grading

Text ASR cannot reliably grade phoneme quality. V1 therefore evaluates whether the child communicated the intended meaning. Dedicated pronunciation assessment, if added later, is a separate subsystem with separate evidence requirements.

### Voxel visual style

The block-based style keeps map generation simple, visually understandable, and compatible with AI-generated layouts while controlling asset complexity.

### V1 validation strategy

First prove the model with one end-to-end restaurant-like scene. Only after that should the architecture expand to richer scene generation, hook systems, or content tooling.

## Dependencies and Assumptions

- **Rendering:** Three.js rather than custom low-level WebGL.
- **ASR:** replaceable speech-recognition path; child-English accuracy must be benchmarked.
- **TTS:** replaceable English TTS path; naturalness must be evaluated with target users and native-English listeners.
- **Language interpretation:** an LLM may be used for semantic routing, always behind deterministic runtime authority and a local fallback.
- **Target devices:** desktop browsers were the historical starting point, but current EngKid work must also profile real iPad Safari performance.

## Research Gates

1. Benchmark ASR on at least 50 representative child-English utterances.
2. Compare TTS naturalness and pronunciation consistency for target vocabulary.
3. Measure language-routing accuracy and P95 response latency.
4. Validate declarative coverage across several different learning scenes.
5. Profile Three.js + voice interaction on actual iPad hardware.
6. Delay a general hook DSL until at least three real scenes reveal repeated hook patterns.

When these gates are satisfied, structured implementation planning can refine the engine without changing the product principles above.
