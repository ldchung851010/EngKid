# Cost-Controlled Open Deployment — Requirements

## Problem

HiKid.Fun is intended to be open source while also supporting a limited public online experience. The early implementation behaved like a local demo: learner progress and collected vocabulary lived in shared server SQLite, TTS requests were synthesized repeatedly, and AI calls were spread across several routes without unified cost governance.

That creates two problems:

1. Self-hosters must understand server-owned learner data and multiple AI configuration paths.
2. A public free deployment can accumulate uncontrolled AI/TTS cost and accidentally mix learner state between visitors.

The target product should use the same core code for both self-hosted and public operation while making ownership, privacy, resource limits, and degraded behavior explicit.

## Actors

### A1. Child learner

Plays scenes, speaks English, earns scores, and collects words. The learner expects progress to belong to the current browser unless an account/sync product is introduced later.

### A2. Self-hosted operator

Clones the project and wants a small, understandable configuration surface. The first target is one text-AI provider key plus clearly documented TTS/local-ASR requirements.

### A3. Public-site operator

Runs a limited free experience and needs predictable AI/TTS resource use, transparent limits, and useful observability without collecting child content.

### A4. Engine/server

Provides scene metadata, voice capabilities, text-AI interpretation, examples, caching, and resource-policy enforcement.

## Core Flows

### F1. Browser-local learner data

**Trigger:** the child completes a task, earns a score, changes a preference, or collects vocabulary.

1. Update browser learner storage.
2. Portal/runtime read the same local data service.
3. Export, import, and reset are available through a parent/settings entry.

**Outcome:** progress does not depend on shared server SQLite and does not automatically leak between visitors.

### F2. TTS cache hit

**Trigger:** the frontend requests speech for text.

1. Build a cache key from output-affecting parameters.
2. If cached audio exists, return it directly.
3. Otherwise synthesize, store, and return it.

**Outcome:** common dialogue, vocabulary, and repeated listening become cheaper over time.

### F3. Public quota exhausted

**Trigger:** a client or the whole public site exceeds configured AI/TTS policy.

1. Reject new expensive requests with a typed response.
2. Show a clear English message.
3. Preserve non-AI functions and already cached/local functions where possible.

**Outcome:** the site does not silently degrade or consume unbounded cost.

### F4. Simple self-hosting

**Trigger:** an operator clones and starts the project.

1. Configure one server-side text LLM key.
2. Intent routing and example generation share that provider boundary.
3. ASR remains browser-local by default.
4. Missing capabilities are clearly reported.

**Outcome:** deployment configuration remains understandable without exposing secrets to the browser.

## Requirements

### Browser learner data

- **R1.** Move learner-specific progress from required server SQLite to browser storage. Include scene completion, score, last-played time, collected words, and extensible preferences.
- **R2.** Portal and scene runtime use this browser data to compute learner-specific state.
- **R3.** Provide JSON export of the complete learner document.
- **R4.** Support JSON import and reset with cancelable confirmation before destructive changes.
- **R5.** Explain that data is stored in the current browser and export/import is the V1 backup/migration mechanism.
- **R6.** Export includes a schema version. Import validates format, version, size, and structure before replacing existing data atomically.
- **R7.** Parent/settings actions must be accessible without sitting in the child's main play path. Errors cannot rely on color alone; modals need basic keyboard/focus support.

### TTS cost control

- **R8.** Cache all TTS requests whose output can be deterministically reused.
- **R9.** Cache hits bypass live synthesis.
- **R10.** Cache location and invalidation/version behavior must be configurable and operationally visible.
- **R11.** Public TTS governance includes per-IP frequency, text-length bounds, allowed voice/speed ranges, cache-miss budget, and clear rejection behavior. Defaults should be generous enough for normal repeated listening.

### Unified text-AI governance

- **R12.** All text-LLM capabilities use one governed server-side provider boundary.
- **R13.** Browser-local ASR is the default V1 path and does not consume text-AI quota.
- **R14.** Public deployments support per-IP frequency limits.
- **R15.** Public deployments support a site-wide daily AI allowance.
- **R16.** Quota exhaustion produces one consistent UI model across dialogue, examples, and other AI entry points. The message should explain that today's online AI capacity is unavailable and that non-AI content can still be used.
- **R17.** Self-hosting targets one text LLM provider/key for intent routing and example generation.
- **R18.** Missing provider capability must be reported explicitly rather than as a generic failure.
- **R19.** Operators can see aggregate usage, rejection counts, and quota state without seeing learner payloads.
- **R20.** Provider keys stay only in server environment variables/deployment secrets and never enter browser bundles, local storage, learner exports, or logs.
- **R21.** Send only minimum necessary content to external providers. Do not log raw child audio, transcripts, complete prompts, provider keys, or authorization headers. With local ASR, raw audio remains local by default.

### Deployment experience

- **R22.** Documentation describes both self-hosted/local and public-online modes.
- **R23.** The server may provide AI/TTS/content services but is not the default owner of learner progress.
- **R24.** Scene metadata endpoints do not remain the authoritative source of learner completion/score/unlock state.

## Acceptance Examples

### AE1 — Export/import/reset

Browser A contains completed-scene and vocabulary data. Export creates a versioned JSON document. Browser B validates that document, shows a replacement confirmation, then imports it successfully. Corrupt, empty, oversized, or incompatible files are rejected without overwriting current data. Reset also requires explicit confirmation.

### AE2 — TTS cache

The first request for `hamburger` with voice `Kiki` and speed `0.75` synthesizes and caches audio. The second identical request is a cache hit. Speed `1.0` is a separate entry. Excessive unique cache misses from one IP can be rejected after a deliberately generous learning-friendly threshold.

### AE3 — Daily AI limit

When the public site's daily AI limit is reached, new intent/example requests return a clear limit state. Already loaded scenes, local progress, browser-local ASR, collected words, and non-AI interactions remain usable where possible. Operators can observe the limit state and aggregate counts.

### AE4 — One text-AI key

A self-hoster configures one server-side LLM key. Intent routing and example generation work through it. ASR remains local. The key is absent from browser code, local learner data, exported JSON, and logs.

### AE5 — Independent browsers

Two browser instances visit the same public deployment. Each computes score, completion, and unlock state from its own local learner data rather than shared historical server rows.

## Success Criteria

- Self-hosting has a clear configuration model centered on one text-AI provider key.
- Public hosting cannot consume unlimited AI/TTS resources by default.
- Learner progress does not mix between unrelated browsers.
- Children and parents understand quota exhaustion as a resource limit rather than an application crash.
- Implementation work can focus on storage, caching, quotas, and provider adapters without inventing new product behavior.

## Out of Scope

- accounts and cloud sync;
- automatic cross-device synchronization;
- multiple family profiles inside one browser;
- paid plans, quota purchases, or waiting queues;
- a requirement that the entire product work fully offline;
- provider/cloud ASR as the default V1 path;
- server SQLite as the default learner-data owner;
- detailed choice of a specific rate-limit library during requirement definition;
- a full operations dashboard.

## Product Decisions

- **Browser ownership:** solves public-user isolation and reduces self-hosting database burden.
- **Export/import as V1 portability:** supports backup and deliberate browser-to-browser transfer without introducing accounts.
- **Validate before replace:** imported JSON is untrusted input and cannot modify current data until validation succeeds.
- **Full TTS caching:** dynamic examples and tutor phrases can be cached when all output inputs match.
- **Caching is not rate limiting:** TTS generation still requires explicit resource policy.
- **Honest quota UX:** when online AI is unavailable, say so directly rather than pretending a lower-quality response is equivalent.
- **Local ASR by default:** reduces public AI cost and avoids uploading raw child speech unless a future product decision explicitly changes that.
- **Server-only secrets:** simpler configuration cannot come at the cost of exposing provider credentials.
- **Data minimization:** external AI receives only the context required for the feature.
- **One product shape, configurable resources:** self-hosted and public modes should differ mainly in configuration and limits rather than product logic.

## Technical Questions for Implementation

- Storage service interface and future migration from `localStorage` to IndexedDB if data grows.
- TTS cache retention, size limit, and model-version invalidation.
- Quota ledger storage for multi-instance deployments.
- Trusted client-IP extraction behind reverse proxies/CDNs.
- Provider adapter behavior when one text-AI feature is unsupported.
- Consistent quota/error copy across child-facing screens.

These are implementation decisions, not reasons to weaken the product requirements above.
