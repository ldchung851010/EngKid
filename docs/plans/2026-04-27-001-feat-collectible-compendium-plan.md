---
title: "feat: Add a scene collectible compendium for game-based vocabulary learning"
type: feat
status: completed
date: 2026-04-27
origin: docs/brainstorms/2026-04-27-collectible-compendium-requirements.md
---

# Collectible Compendium System — Implementation Plan

## Overview

Add a game-based vocabulary collection system to the scene engine. Words from each scene's `targetVocabulary` automatically become collectible objects distributed through the 3D world. When a child approaches an object, it glows and shows an interaction prompt. Activating it opens a focused learning moment: a large SVG appears, TTS pronounces the word, the child may replay it, and confirming the word triggers a celebration before the collection state is persisted.

The portal gains a compendium overlay grouped by scene, showing collection progress, TTS replay, and child-friendly example sentences.

This system runs independently from NPC dialogue and task progression. A scene author gets the default collectible behavior simply by defining `targetVocabulary`; an optional `collectibles` field can override placement or visuals.

## Product Principle

Vocabulary learning is the primary outcome; collecting is only the game mechanic that motivates exploration.

## Requirements

### In-scene interaction

- R1. Generate collectible objects from `targetVocabulary` and place them in the 3D world.
- R2. Within roughly two meters, highlight the nearest collectible and show an interaction prompt.
- R3. Activating the object opens the discovery overlay and immediately pronounces the word with TTS.
- R3a. Previously collected objects do not reappear in later sessions.
- R3b. Uncollected objects do not reveal their word as a text hint before discovery.
- R3c. A speaker button allows unlimited pronunciation replay.
- R3d. A `Got it!` action confirms collection, plays celebration feedback, persists the item, and removes it from the scene.

### Persistence

- R4. Persist collection records with `word`, `scene_id`, and `collected_at`.
- R4a. Load collected items when a scene starts and hide them.
- R4b. Save immediately when the child confirms the item rather than waiting for session end.

### Compendium

- R5. Add a compendium entry beside the star count and display the total collected count.
- R6. Load collection statistics with the portal data.
- R7. Show a full-screen overlay grouped by scene; collected items use full visuals and labels, while missing items use obscured silhouettes.
- R7a. Close with the close action, backdrop, or Escape.
- R7b. Keep keyboard focus inside the open overlay.
- R8. Tapping a collected item pronounces the word.
- R9. Generate a short, age-appropriate English example sentence and simple English explanation; pronounce the example sentence.
- R9a. Cache examples for the lifetime of the current portal page to avoid repeated LLM calls.

## Scope

Deferred:
- rarity tiers;
- collection rewards;
- advanced random placement;
- differentiated sound effects by rarity or scene;
- compendium search/filtering;
- mobile-specific touch interaction.

Out of scope:
- achievement-badge platform;
- social sharing or leaderboards;
- NFT/blockchain mechanics.

## Existing Patterns to Reuse

| Need | Existing pattern |
|---|---|
| Proximity detection | NPC proximity checks in the main scene loop |
| Keyboard interaction | Existing document-level input handlers |
| Overlay UI | Loading, microphone, and score overlays |
| TTS | Existing TTS service/endpoint |
| Sprite prompts | NPC indicator sprites |
| 3D markers | Scene primitive helpers |
| Scene schema | `SceneConfig` and validator |
| Persistence | Existing data-storage patterns |
| Server routes | Existing API route structure |
| Portal UI | `src/portal/portal.ts` |

## Key Technical Decisions

- **Focused discovery mode:** opening a collectible overlay releases pointer lock so the child can use overlay controls safely.
- **Celebration sound:** use a tiny Web Audio-generated two-note effect rather than adding an external audio dependency.
- **3D collectible marker:** use a floating marker with emissive material plus a sprite halo instead of a post-processing bloom pipeline.
- **Placement:** scan valid walkable floor cells, exclude unsafe/NPC-adjacent positions, and distribute items deterministically. Explicit scene overrides take priority.
- **Portal TTS:** call the existing TTS API and play the returned audio through `HTMLAudioElement` rather than initializing an additional engine-level TTS instance.
- **Visual fallback:** if a word lacks a dedicated SVG, render a styled circle with the word's first letter.
- **Example generation:** request a maximum-eight-word English sentence and a short child-friendly English explanation. Return structured JSON `{ sentence, explanation }`.
- **Nearest-item rule:** if multiple collectibles are in range, activate only the nearest; ties resolve by stable placement order.
- **Discovery timeout:** leaving the area does not immediately close an opened discovery overlay; inactivity closes it without saving.
- **Listening gate:** show the confirmation action only after the first pronunciation playback completes, so every collected word is heard at least once.

## High-Level Flow

```text
Child explores
  → collectible comes within range
  → glow + interaction prompt
  → child activates collectible
  → discovery overlay opens
  → TTS pronounces word
  → child may replay pronunciation
  → child confirms
  → celebration feedback
  → persist item
  → remove item from scene
```

Compendium flow:

```text
Portal loads collection data
  → group items by scene
  → show total count
  → child opens compendium
  → collected words are interactive
  → tap a word
  → pronounce word
  → load/cache simple example
  → show example + pronounce sentence
```

## Data Model

```ts
interface CollectibleOverride {
  word: string;
  position?: { x: number; y: number; z: number };
  svg?: string;
}
```

Persistent record concept:

```text
collectibles
- word
- scene_id
- collected_at
- unique(word, scene_id)
```

API surface:

```text
GET  /api/collectibles
POST /api/collectibles
POST /api/example
```

## Implementation Units

### U1. Persistence, API, and scene-schema extension

Add the collection data model, read/write API, optional scene overrides, and validation. Validate non-empty words, numeric positions, and duplicate words. Test empty state, filtering, idempotent updates, invalid requests, and valid/invalid scene overrides.

### U2. Vocabulary SVG mapping

Create `getSvgForWord(word)` with explicit SVG mappings for common scene vocabulary and a deterministic first-letter fallback. Test mapped and unmapped words and ensure output is valid SVG.

### U3. Celebration sound

Create a small Web Audio helper that plays a friendly two-note effect, handles suspended audio contexts, and fails gracefully when Web Audio is unavailable.

### U4. In-scene collectible manager

Create placement, rendering, proximity detection, discovery overlay, TTS replay, confirmation, persistence, cooldown, and cleanup behavior. Keep pure placement/proximity logic separately testable from DOM and Three.js integration.

Important integration rules:
- only one active collectible at a time;
- prevent repeated opening of the same overlay;
- remove an item only after a successful local confirmation flow;
- recover gracefully from persistence/TTS failures;
- clean up listeners and 3D objects when changing scenes.

### U5. Example endpoint

Add a server endpoint that accepts `{ word, cefrLevel }` and returns structured English-only learning support:

```json
{
  "sentence": "I drink water every day.",
  "explanation": "Water is something we drink."
}
```

Keep provider errors non-fatal: the compendium must still provide pronunciation even if example generation is unavailable.

### U6. Portal compendium

Add the compendium button, total count, grouped overlay, collection progress, collected/missing card states, pronunciation, example bubbles, focus trapping, loading/error states, and responsive scrolling.

### U7. Integration hardening

Verify the complete flow across multiple scenes and sessions. Ensure collectible input coexists with speaking controls and camera controls, overlays restore interaction correctly, API failures degrade gracefully, and completed scenes contain no leftover collectible markers.

## Acceptance Checklist

- Enter a scene and discover a vocabulary object.
- Hear the word before confirmation becomes available.
- Replay pronunciation.
- Confirm and receive celebration feedback.
- Reload the scene and verify the collected object stays hidden.
- Open the portal compendium and see the correct total and per-scene progress.
- Tap a collected word and hear pronunciation.
- Load an English-only example sentence and explanation.
- Repeated taps use the page cache rather than repeated LLM calls.
- API or TTS failure does not crash the portal or scene.

## Risks

| Risk | Mitigation |
|---|---|
| Sparse initial SVG coverage | Always provide a first-letter fallback. |
| Pointer-lock transition is confusing | Use a clear overlay transition and restore normal canvas interaction afterward. |
| Generated examples are too difficult | Keep strict length/age constraints and allow provider-independent replacement. |
| LLM outages/cost | Cache examples and degrade to pronunciation-only mode. |
| Interaction key is not intuitive for young children | Treat keyboard input as desktop-only and add a touch action in the mobile/iPad path. |
| Persistence has no user separation in early prototypes | Keep local/prototype scope explicit and add learner identity before multi-user deployment. |

## Sources

- **Origin:** [docs/brainstorms/2026-04-27-collectible-compendium-requirements.md](../brainstorms/2026-04-27-collectible-compendium-requirements.md)
- Existing scene, TTS, persistence, and portal implementation patterns in this repository.
