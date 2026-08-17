---
title: "feat: Cost-controlled open-source deployment and public online experience"
type: feat
status: completed
date: 2026-04-29
origin: docs/brainstorms/2026-04-29-cost-controlled-open-deployment-requirements.md
---

# Cost-Controlled Open Deployment — Implementation Plan

## Overview

This plan evolves HiKid.Fun from a local demo with server-owned learner progress and scattered AI/TTS calls into a product that can support both self-hosting and a limited public online experience from the same codebase.

The main changes are:

- learner data belongs to the browser rather than shared server SQLite;
- browser-local ASR remains the default path;
- text-AI capabilities share one governed server-side provider entry point;
- TTS uses full-request caching and explicit resource limits;
- public deployments expose honest quota states instead of silently degrading;
- server secrets and child data remain separated from browser storage and logs.

## Goals

1. Make self-deployment simple: one text-LLM provider key should cover intent routing and example generation.
2. Keep ASR local by default so raw child audio does not need to leave the browser.
3. Remove shared server progress as the product's source of truth.
4. Prevent unlimited AI/TTS use from creating uncontrolled public-hosting cost.
5. Keep normal child learning flows usable and understandable when online AI capacity is exhausted.
6. Preserve replaceable provider and storage boundaries for future deployment models.

## Requirements Trace

### Browser-owned learner data

- R1. Persist scene completion, score, last-played time, collected vocabulary, and preferences in browser storage.
- R2. Portal and runtime derive completion, score, collection, and unlock state from the same client-side learner store.
- R3. Provide export of the complete learner document as readable JSON.
- R4. Provide import and reset actions with explicit confirmation before destructive replacement.
- R5. Explain that the first version stores data only in the current browser; JSON export/import is the supported backup and migration mechanism.
- R6. Exported data includes a schema version. Import validates version, structure, and size before atomically replacing current data.
- R7. Parent/settings actions must remain outside the child's primary play path and remain keyboard-accessible.

### TTS caching and governance

- R8. Cache every TTS request, not only fixed dialogue.
- R9. A cache hit returns existing audio without invoking live synthesis.
- R10. Cache behavior must include a configurable location and a safe invalidation boundary when model/output parameters change.
- R11. Public deployment limits include text length, voice/speed ranges, per-IP generation frequency, cache-miss budget, and clear rejection behavior.

### Text AI and quota governance

- R12. Intent routing, example generation, and future text-AI features use one governed server-side AI entry point.
- R13. Browser-local ASR is not charged against online text-AI quota in this version.
- R14. Public deployment supports per-IP frequency limits.
- R15. Public deployment supports a site-wide daily AI allowance.
- R16. When an allowance is exhausted, the UI explains that today's online AI capacity is unavailable while non-AI content remains usable.
- R17. Self-hosting targets one text-LLM provider/key for intent and example generation.
- R18. Missing provider capability is reported explicitly rather than failing silently.
- R19. Operators can observe current AI/TTS usage, rejection counts, and limit state without accessing child payloads.
- R20. Provider keys exist only in server-side environment variables or deployment secrets.
- R21. Server logs never contain raw child audio, full transcripts, complete prompts, authorization headers, or provider keys.

### Deployment behavior

- R22. Documentation distinguishes local/self-hosted and public-online operation.
- R23. The server remains an AI/TTS/content proxy, not the default owner of learner data.
- R24. `/api/scenes` returns scene metadata rather than authoritative learner progress; the browser computes learner-specific state locally.

## Scope Boundaries

Deferred or excluded:

- accounts, cloud sync, automatic cross-device synchronization, or family profiles;
- paid subscriptions, quota purchases, queues, or commercial billing;
- provider ASR as the default path;
- a complex operations dashboard;
- automatic migration of shared legacy SQLite progress into browser-owned data;
- distributed quota storage such as Redis/KV for the first single-instance deployment.

## Existing Code Paths to Change

- `src/portal/portal.ts` previously combined `/api/scenes`, `/api/progress`, and `/api/collectibles`; it should instead combine static scene metadata with browser learner state.
- `src/main.ts` should save scene completion to the browser learner store.
- `src/engine/collectibles/CollectibleManager.ts` should read/write collections through the browser learner store.
- `server/src/routes/scenes.ts` should not mix server progress into scene metadata.
- `server/src/routes/tts.ts` is the insertion point for full-request audio caching and TTS limits.
- `server/src/routes/intent.ts` and `server/src/routes/example.ts` should share a provider client and resource governor.
- `src/engine/voice/IntentRouter.ts` retains local keyword fallback for provider failure or quota exhaustion.
- `src/engine/voice/WhisperASR.ts` keeps local model caching and browser-local ASR.

## Key Technical Decisions

### Browser learner document

Use one versioned, encapsulated learner document stored through a dedicated service. `localStorage` is acceptable for the first version because the data is small and export/import is simple. The storage implementation stays behind an interface so a later migration to IndexedDB does not change portal or runtime behavior.

The learner store is the only source of truth for:

- scene completion;
- best/current score as defined by product logic;
- last played time;
- collected vocabulary;
- learner preferences.

All writes must catch browser-storage errors such as quota or private-mode restrictions.

### Static scene metadata

`GET /api/scenes` returns scene identity and pedagogical metadata. Learner-specific fields such as completion, score, and unlock state are calculated locally.

Legacy shared SQLite progress is not migrated automatically because there is no reliable mapping from old shared rows to a particular browser learner.

### TTS cache key

The cache key must include every input that can alter audio output, at minimum:

```text
normalized text
voice
speed
model/version identifier
output format/version
```

A cache hit consumes no live synthesis budget. Cache misses may consume a separate TTS budget. Cache location and cleanup policy remain configurable.

### Resource governor

AI and TTS share a common governance concept but can use independent ledgers because their cost models differ.

A first implementation may use process memory keyed by date and client IP. The interface should permit replacement with shared storage for multi-instance deployment.

Responses rejected by policy use a typed `429`/quota result and a `Retry-After` value where appropriate.

### Unified text-AI provider

Intent classification and vocabulary examples use the same text provider configuration. The provider adapter validates model output before returning structured data to application code.

ASR remains outside this provider boundary in V1.

### Privacy-preserving observability

Allowed log fields include:

- route/resource category;
- cache hit/miss;
- quota allow/reject result;
- HTTP status;
- latency;
- request ID.

Do not log learner speech payloads, transcripts, prompts, generated secrets, authorization values, or exported learner documents.

## Implementation Units

### U1. Browser learner store

Create a versioned learner data service with APIs for progress, collectibles, preferences, export, import, reset, schema validation, and atomic replacement.

Test:
- empty/default document;
- write/read progress;
- collectible idempotency;
- export/import round trip;
- malformed JSON;
- unsupported version;
- oversized import;
- storage write failure;
- reset confirmation integration.

### U2. Portal migration

Update portal state so scene cards, unlocks, score tree, and compendium use static scene metadata plus browser learner data.

The settings entry exposes export/import/reset and clearly states that data is stored in the current browser.

### U3. Scene/runtime migration

Replace server progress writes with learner-store writes. Keep session scoring independent, then persist the appropriate summary locally at completion.

### U4. Collectible migration

Read and write collection evidence through the same learner store. Previously collected objects stay hidden across sessions in the same browser.

### U5. TTS cache and limits

Add deterministic cache keys, disk cache, input validation, cache-hit headers/telemetry, and configurable per-IP/site limits for synthesis misses.

Normal replay of already cached words/dialogue should remain inexpensive and available.

### U6. Text-AI gateway and limits

Refactor intent/example provider calls behind one client and one quota/governance layer. Validate structured provider output and retain application-specific fallback behavior.

### U7. Typed quota UX

Map server quota responses to clear English UI messages. A child should understand that online AI is temporarily unavailable without interpreting the entire app as broken.

Example:

> Today's online AI limit has been reached. You can still explore, review words, and use available offline features.

### U8. Deployment and privacy documentation

Document:
- local/self-hosted mode;
- public online mode;
- required and optional environment variables;
- learner-data ownership;
- browser-local ASR behavior;
- TTS cache settings;
- AI/TTS quota knobs;
- secrets handling;
- privacy and logging boundaries;
- limitations of in-memory quota ledgers.

## Acceptance Examples

### AE1 — Local learner data

A child completes a scene and collects vocabulary in browser A. Refreshing the portal preserves the same local progress. Exporting JSON and importing it into browser B reproduces the learner state only after validation and confirmation. Invalid or incompatible files do not overwrite current data.

### AE2 — TTS cache

The first request for `hamburger` with the same voice/speed/model parameters creates audio and caches it. The second identical request returns cached audio without live synthesis. Changing speed or another output-affecting parameter creates a distinct cache entry.

### AE3 — Public quota exhausted

When daily text-AI capacity is exhausted, intent/example requests return a typed limit result. Scene exploration, local learner state, local ASR, already cached audio, and non-AI interactions remain available where technically possible.

### AE4 — Self-hosting with one text AI key

A self-hosted operator configures one server-side text LLM key. Intent routing and example generation use it; local ASR requires no additional provider key. No provider key appears in the browser bundle, local storage, learner export, or logs.

### AE5 — Scene metadata separation

Two browsers loading the same public `/api/scenes` metadata compute independent completion, score, and unlock state from their own browser learner stores.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Browser storage can be cleared by the user | Provide explicit JSON export/import and explain the storage model. |
| In-memory quotas reset on restart and are not globally consistent | Accept for single-instance demos; keep a replaceable ledger interface for Redis/KV later. |
| Client IP can be spoofed behind a misconfigured proxy | Trust only a controlled proxy/CDN and configure forwarded-IP behavior explicitly. |
| TTS cache grows indefinitely | Make cache location/retention operationally visible and add cleanup/lifecycle controls. |
| AI output is malformed | Validate structured output server-side before application use. |
| Quota copy frustrates children | Use calm, concrete English and preserve non-AI learning paths. |
| Logging leaks learner content | Use event metadata only; never log raw child payloads. |

## Verification

- `npm test` / headless learner-store and policy tests pass.
- `npm run build` passes.
- Export/import/reset works in the browser.
- Different browser profiles show independent progress.
- TTS cache hits do not invoke the live synth path.
- AI/TTS limit responses are deterministic and understandable.
- Provider secrets are absent from production browser assets.
- Logs contain no raw learner speech/transcript/prompt data.

## References

- Origin: `docs/brainstorms/2026-04-29-cost-controlled-open-deployment-requirements.md`
- MDN Web Storage API and browser storage quota guidance.
- Fastify request/proxy documentation.
- OWASP logging guidance.
- Provider API documentation used by the current deployment.
