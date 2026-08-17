# Scene Collectible Compendium — Requirements

## Problem

Vocabulary learning originally happened mainly inside NPC dialogue tasks. After completing a dialogue, children had little reason to keep exploring the 3D scene. The product needs an additional loop that rewards curiosity and repeated exposure to English words without turning vocabulary into a passive flashcard list.

The proposed loop is:

**explore → discover → hear → understand → collect → review**

Collecting is the game mechanic; vocabulary learning remains the primary goal.

## Actors

### A1. Child learner

A child ages 6–12 explores a voxel scene, notices nearby collectible objects, discovers English vocabulary, listens to pronunciation, confirms the discovery, and later reviews collected words in a compendium.

### A2. Engine/system

The engine manages collectible placement, rendering, proximity interaction, discovery UI, persistence, TTS pronunciation, compendium rendering, and example generation.

### A3. Scene author

A human or AI author defines `targetVocabulary`. The engine can automatically turn these words into collectibles. Optional `collectibles` configuration may override position, illustration, or other presentation details.

## User Flows

### F1. Discover and learn a word

**Trigger:** the child approaches an uncollected item.

1. The item becomes visually noticeable within an interaction radius.
2. A clear interaction cue appears.
3. Activating the object opens a focused discovery overlay.
4. The English word is pronounced immediately with TTS.
5. A speaker control allows unlimited replay.
6. After the first pronunciation has played, a confirmation action becomes available.
7. Confirming plays friendly celebration feedback, records the word, and removes or marks the object as collected.

**Outcome:** the child hears the word before the collection is completed and can review it later.

### F2. Open the compendium

**Trigger:** the child opens the word-collection control in the portal.

1. The portal shows the total number of collected words.
2. A large overlay groups vocabulary by scene.
3. Collected words show their illustration and English label.
4. Missing words appear as obscured/silhouette items without revealing unnecessary answers.

**Outcome:** the child sees progress and is encouraged to return to scenes.

### F3. Review a collected word

**Trigger:** the child taps a collected word in the compendium.

1. TTS pronounces the word.
2. The system provides a very short, age-appropriate English example sentence.
3. The system provides a **simple English explanation** suitable for a young learner.
4. TTS can pronounce the example sentence.
5. The example and explanation appear in a nearby bubble or focused detail view.

**Outcome:** the child connects sound, meaning, and usage without switching into another language.

## Requirements

### In-scene collectible interaction

- **R1.** Generate one collectible opportunity for words in `targetVocabulary`, subject to valid placement constraints.
- **R2.** When the child is within the interaction radius, highlight the nearest collectible and show an interaction cue.
- **R3.** Activating the collectible opens a discovery moment and immediately pronounces the word.
- **R3a.** Already collected words do not reappear as active collectibles in later sessions.
- **R3b.** Before discovery, the collectible should not expose the answer through a text label.
- **R3c.** A speaker/replay control supports unlimited pronunciation replay.
- **R3d.** A confirmation action completes collection, plays celebration feedback, persists the state, and removes the active collectible from the current scene.

### Persistence

- **R4.** Persist at minimum `word`, `scene_id`, and `collected_at` or equivalent learner evidence.
- **R4a.** On scene load, hide words already collected by the current learner/browser.
- **R4b.** Save when collection is confirmed rather than waiting for session end.

The historical first version used server SQLite. Current EngKid architecture may use browser-local learner storage; the behavioral requirement is persistence for the same learner context, not a specific database technology.

### Portal entry and compendium

- **R5.** Add a word-collection/compendium entry near other progress indicators and show total collected count.
- **R6.** Load collection state together with portal learner state.
- **R7.** Open a large or full-screen overlay grouped by scene.
- **R7a.** Collected items use full visuals + English word labels; missing items use obscured visuals + question marks.
- **R7b.** The overlay closes through an explicit close action, backdrop, or Escape where keyboard input is available.
- **R7c.** Keyboard focus stays inside the modal while it is open.

### Vocabulary learning interaction

- **R8.** Tapping a collected item pronounces the word.
- **R9.** Generate or retrieve a short English example sentence plus a short **English-only** explanation appropriate for a child.
- **R9a.** Avoid repeated unnecessary model calls for the same word during the same page/session; use a memory or persistent cache as appropriate.
- **R9b.** If example generation is unavailable, pronunciation and collected-state review still work.

## Acceptance Examples

### AE1 — Discover, hear, and collect

The scene includes `targetVocabulary: ['hamburger', 'pizza', 'salad']`. A child approaches an active collectible. The object highlights, the child activates it, hears “hamburger,” replays it several times, then confirms. Celebration feedback plays and the word is recorded. Reloading the scene does not make the same word active again.

If the child opens the discovery view but closes the page before confirming, the word remains available later.

### AE2 — Compendium progress

The portal shows a word-collection count. Opening the compendium displays a Restaurant group with collected illustrations and labels plus obscured missing items. The child can close the overlay safely.

### AE3 — English-only review

The child taps `hamburger`. The app pronounces the word and shows a child-friendly example such as:

```text
I eat a hamburger for lunch.
A hamburger is food with a bun and filling.
```

The sentence can also be spoken aloud. No Chinese translation or explanation is required.

## Success Criteria

- Children voluntarily keep exploring after the core dialogue task.
- Every discovery requires at least one meaningful pronunciation exposure before collection confirmation.
- Reopening the product preserves the collected state for the same learner context.
- The portal makes progress visible without revealing all missing vocabulary answers.
- Scene authors get useful default behavior by defining only `targetVocabulary`.
- English review remains usable even if AI example generation is unavailable.

## Out of Scope

- rarity tiers such as common/rare/legendary;
- collection rewards or cosmetic unlock systems;
- cross-scene achievement platforms;
- randomized dynamic placement systems before simple placement is validated;
- elaborate sound libraries by scene or rarity;
- compendium search/filtering for V1;
- social sharing and leaderboards;
- NFT/blockchain mechanics.

## Design Decisions

### Parallel to dialogue tasks

The collectible system does not block NPC dialogue and dialogue does not need to unlock collection. Both loops can coexist in the same scene.

### Discovery before text answer

Collectibles should not expose their word name before activation. Visual discovery and proximity are enough to create curiosity.

### Default + override architecture

The engine provides automatic behavior for `targetVocabulary`; an optional override structure can refine placement or illustration without forcing every scene author to duplicate configuration.

### Touch/iPad support

The original desktop prototype considered the `E` key. Current EngKid must expose equivalent tap/touch interaction on iPad rather than depending on a hardware keyboard.

## Dependencies and Risks

- **Vocabulary illustrations:** provide a fallback visual for words without dedicated art.
- **TTS:** pronunciation quality must be clear and native-like enough for child English learning.
- **Example generation:** model output must stay short, safe, English-only, and age-appropriate.
- **Persistence:** learner state must not leak across unrelated users in a public deployment.
- **Interaction:** proximity and overlay controls must not conflict with speaking controls or camera movement.

## Follow-up Validation

1. Measure whether collectibles increase voluntary exploration time.
2. Track how often children replay pronunciation.
3. Test whether English-only explanations are understandable at the target learner level.
4. Test touch interaction on real iPad Safari.
5. Confirm that collectible review supports, rather than distracts from, meaningful speaking missions.
