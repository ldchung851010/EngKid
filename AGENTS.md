# HiKid.Fun — Agent Instructions

## Project Overview

HiKid.Fun is a Three.js voxel-scene engine that provides an immersive English speaking experience for children ages 6–12. The engine encapsulates rendering, the speech pipeline, intent routing, scoring, and the session lifecycle. Scene authors, whether human or AI, define new scenes through declarative configuration.

## Technology Stack

| Layer | Solution |
|---|---|
| Rendering | Three.js 0.184.0 + InstancedMesh |
| TTS | Server-side Kitten TTS proxy + WAV disk cache |
| ASR | Browser-local Whisper; optional cloud GLM-ASR, enabled automatically when `GLM_API_KEY` is configured |
| Intent routing | DeepSeek Chat through the unified backend AI gateway |
| State machine | XState v5 |
| Build | Vite + TypeScript strict |
| Backend proxy | Fastify |
| Learning data | Browser-local `LearningDataStore` with export/import/reset |

## Project Conventions

### File Structure

```text
src/
  engine/          # Core engine; independent of any specific scene
    renderer/      # Three.js voxel rendering
    voice/         # TTS, ASR, intent routing, microphone UI
    runtime/       # Session state machine, scene loading, browser learning data
    scoring/       # Score tracking
    schema/        # Scene configuration types and validators
  scenes/          # Scene definitions; each scene uses config.ts + hooks.ts
    restaurant/    # Restaurant
    school/        # School
    zoo/           # Zoo
    airport/       # Airport
    hotel/         # Hotel
server/            # Backend API proxy for TTS, text AI, scene metadata, and quotas
docs/
  brainstorms/     # Requirements documents
  plans/           # Planning documents
  solutions/       # Knowledge base for solved issues, organized by YAML frontmatter and categories such as integration-issues/ and build-errors/
tests/
  unit/
  headless/
```

### Naming Conventions

- TypeScript strict mode
- `camelCase` for variables, functions, and methods
- `PascalCase` for classes, interfaces, and types
- Scene configuration fields use `snake_case`, following JSON/YAML conventions
- Engine APIs / Scene APIs use `camelCase`, following JavaScript conventions

### Architecture Principles

1. **The engine is a constraint layer, not a utility library.** It encapsulates rendering, speech, scoring, and lifecycle behavior while scenes only declare content.
2. **Intent routing uses an LLM, not a fixed classifier.** Intents are described in natural language in configuration and matched at runtime by the LLM.
3. **Hooks do not expose engine internals.** V1 exposes only a few explicit callbacks such as `onBeforeDialogue`, `onIntentMatched`, and `onTaskComplete`.
4. **Push-to-Talk interaction.** The app does not listen continuously; children hold the button while speaking and release it to submit.
5. **Schema validation happens at load time.** Invalid configurations are rejected before rendering and return field-level errors with paths.
6. **Learning data belongs to the browser.** Progress, scores, collected vocabulary, and preferences are stored in the current browser through `LearningDataStore`; the portal's `Data` entry handles export, import, and reset.
7. **Headless tests first.** Core logic should be runnable without WebGL.

## Key Constraints

- **Not a general-purpose game engine:** no physics simulation, particle system, or skeletal animation.
- **Not a learning-management system:** it does not manage curriculum sequencing.
- **Not a pronunciation-assessment platform:** it checks language use but does not perform syllable-by-syllable pronunciation grading.
- **No accounts or cloud sync:** one browser owns one local learning-data set; use export/import for moving between devices.
- **No multiplayer:** the current experience is single-player.
- **Desktop-first origins:** Chrome/Edge were the initial targets, although EngKid is now also being adapted for iPad use.

## Development Commands

```bash
npm run dev         # Frontend dev server (:5173)
npm run build       # Production build
npm run server:dev  # Backend proxy (:3001)
```

## Environment Variables (server/)

```bash
DEEPSEEK_API_KEY=xxx       # Text-AI key for intent routing and example generation
DEEPSEEK_MODEL=deepseek-v4-flash

GLM_API_KEY=xxx            # Optional; enables cloud ASR forwarding
TTS_PORT=8081              # Local kitten-tts-server port
TTS_MODEL_PATH=server/model
TTS_CACHE_DIR=server/data/tts-cache
EXAMPLE_CACHE_DIR=server/data/example-cache

AI_DAILY_LIMIT=5000        # Site-wide daily text-AI request limit
AI_IP_HOURLY_LIMIT=300     # Per-IP hourly text-AI request limit
TTS_DAILY_LIMIT=10000      # Site-wide daily TTS generation limit; cache hits do not count
TTS_IP_HOURLY_LIMIT=600    # Per-IP hourly TTS generation limit; cache hits do not count
ASR_DAILY_LIMIT=5000       # Site-wide daily ASR request limit; cloud mode only
ASR_IP_HOURLY_LIMIT=300    # Per-IP hourly ASR request limit; cloud mode only

CORS_ORIGIN=https://learn.example.com
TRUST_PROXY=true           # Enable only behind a trusted reverse proxy
SERVER_BODY_LIMIT=262144
```

## Git Workflow

- Use conventional commits such as `feat:`, `fix:`, `docs:`, and `refactor:`.
- Create feature branches from `master`.
- PRs must pass type-checking with `npx tsc --noEmit` before merge.
