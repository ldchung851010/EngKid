---
title: feat: Kid portal — scene selection, progress persistence, mascot
type: feat
status: active
date: 2026-04-26
origin: docs/brainstorms/2026-04-26-kid-portal-requirements.md
---

# Kid Portal + SQLite Progress Persistence — V1 Plan

## Overview

Build a child-friendly 2D portal on top of the existing 3D scene engine. A Duolingo-inspired card layout presents playable scenes, a mascot guides the learner, SQLite persists progress, and CEFR ordering plus completion-based unlocking drives the learning journey.

---

## Problem Frame

V1 had only a hard-coded restaurant scene and in-memory browser points that disappeared after closing the app. The product needs a 2D entry experience independent of the 3D engine: scene selection, progress tracking, persistent scores, and child-friendly gamification.

---

## Requirements Trace

- R1. Duolingo-style card layout with large rounded corners, bright colors, and large type.
- R2. Each card shows scene name, description, completion mark, and star score.
- R3. Tapping a card plays a transition and opens the 3D scene.
- R4. Finishing a 3D scene stores the score and returns to the refreshed portal.
- R5. `GET /api/scenes` returns the available scene list.
- R6. Scenes are ordered by CEFR level and unlocked by completion prerequisites.
- R7. SQLite `progress` table: `scene_id, completed, score, last_played_at`.
- R8. `GET /api/progress` returns total score and per-scene progress.
- R9. `POST /api/progress` updates score and completion state.
- R10. Score updates animate with a flying star and tree growth.
- R11. A mascot provides multiple expressions, messages, and micro-animations.
- R12. The mascot appears only in the portal.
- R13. The score tree/tower grows one level per 50 points.
- R14. Score changes trigger the growth animation.
- R15. If the backend is unavailable, show cached data as a fallback.

---

## Scope Boundaries

### Deferred for later

- Multi-user accounts and login.
- Parent dashboard.
- Dedicated mobile adaptation.
- Internationalization.
- Scene-content marketplace.

### Outside this product's identity

- General game publishing platform.
- Course-management system.
- Social network or leaderboard product.

---

## Context & Research

### Existing repository structure

```text
src/engine/    — core engine: rendering, voice, scoring, state machine
src/scenes/    — scene definitions such as restaurant/config.ts
server/        — backend proxy for ASR, intent routing, and TTS
index.html     — current entry point that opens the 3D scene directly
```

### Technology decisions

| Decision | Choice | Reason |
|---|---|---|
| SQLite | `better-sqlite3` | Simple synchronous API; appropriate for the single-process server without WASM overhead. |
| Entry pages | `index.html` for portal, `play.html` for 3D scenes | Keeps the root URL as the entry experience and separates responsibilities clearly. |
| Scene discovery | Runtime scene configuration loading | Avoids a second manual registry and keeps new scenes discoverable. |
| Mascot | CSS illustration + CSS animation | No extra image dependency and small asset footprint. |
| Score tree | SVG + CSS transitions | Easy to animate and simpler than canvas. |

### External references

- `better-sqlite3`: https://github.com/WiseLibs/better-sqlite3
- Duolingo UI patterns: cards, progress indicators, and persistent mascot guidance.

---

## Output Structure

```text
hi-kid-fun/
├── index.html                  # portal: cards, mascot, score tree
├── play.html                   # 3D scene engine entry
├── src/
│   ├── main.ts                 # 3D engine entry
│   └── portal/
│       ├── portal.ts           # portal behavior
│       ├── owl.css             # mascot styling
│       ├── cards.css           # card layout
│       └── tree.css            # score-tree styling
├── server/
│   ├── src/
│   │   ├── index.ts            # API registration
│   │   └── routes/
│   │       ├── scenes.ts       # scene metadata endpoint
│   │       ├── progress.ts     # progress CRUD
│   │       └── db.ts           # SQLite initialization and helpers
│   └── data/
│       └── .gitkeep
```

---

## Key Technical Decisions

- **Separate portal and engine into two HTML pages.** `index.html` is the portal and `play.html` hosts the 3D scene. Vite uses a multi-page `build.rollupOptions.input` configuration. `play.html` reads the scene from `?scene=restaurant`.
- **Load scene metadata dynamically.** The server discovers scene folders and extracts `name`, `description`, and `cefrLevel`, avoiding an additional manual registry.
- **Use one progress row per scene.** `scene_id` is the primary key. V1 is single-user, so upsert semantics are sufficient.
- **Save progress at scene completion and then return to the portal.** The 3D engine posts progress, displays a return action, and navigates back to `/`; the portal then loads current progress.
- **Use CSS rather than image sprites for the mascot.** Simple shapes and keyframe animations provide blinking, waving, jumping, and celebration without additional HTTP assets.

---

## Implementation Units

### Phase 1: Backend foundation

#### U1. SQLite database + progress API

**Goal:** Persist learner scene progress on the server.

**Requirements:** R7, R8, R9

**Files:**
- Install `better-sqlite3` in `server/`.
- Create `server/src/routes/db.ts`.
- Create `server/src/routes/progress.ts`.
- Create `server/data/.gitkeep`.

**Database schema:**

```sql
CREATE TABLE IF NOT EXISTS progress (
  scene_id TEXT PRIMARY KEY,
  completed INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  last_played_at TEXT
);
```

**API behavior:**
- `GET /api/progress`: return all rows and `{ totalScore }`.
- `POST /api/progress`: validate non-empty `sceneId`, non-negative `score`, and boolean `completed`; reject invalid input with HTTP 400; upsert the row and return current progress.
- Store the database at `server/data/progress.db` and ignore it in Git.

**Verification:**

```bash
curl -X POST localhost:3001/api/progress \
  -H 'Content-Type: application/json' \
  -d '{"sceneId":"restaurant","score":10,"completed":true}'

curl localhost:3001/api/progress
```

Expected result: the restaurant is completed with score 10 and `totalScore=10`.

---

#### U2. Scene list API

**Goal:** Return scene metadata plus unlock state.

**Requirements:** R5, R6

**Dependencies:** U1

**File:** `server/src/routes/scenes.ts`

**Approach:**
- Discover subdirectories under `src/scenes/`.
- Load each scene configuration and skip failed imports with a warning rather than crashing the whole endpoint.
- Extract `{ id, name, description, cefrLevel }`.
- Combine metadata with progress.
- Sort by CEFR progression.
- Always unlock the first scene; later scenes require the previous scene to be completed.

Example response:

```json
{
  "scenes": [
    {
      "id": "restaurant",
      "name": "Restaurant",
      "description": "...",
      "cefrLevel": "A1",
      "unlocked": true,
      "completed": false,
      "score": 0
    }
  ]
}
```

---

### Phase 2: Portal frontend

#### U3. Portal shell + card layout

**Goal:** Build the 2D portal with scene cards, bright child-friendly styling, and transitions.

**Requirements:** R1, R2, R3

**Files:**
- Rewrite `index.html` as the portal.
- Create `play.html` from the former 3D entry page.
- Create `src/portal/portal.ts`.
- Create portal CSS.
- Configure Vite multi-page input.

**Portal behavior:**
- Fetch `/api/scenes`.
- Render one card per scene.
- Show unlocked, completed, and locked states clearly.
- Animate an unlocked card when tapped, then navigate to `/play.html?scene=<id>`.
- Show a useful fallback if scene loading fails.

Vite input example:

```ts
build: {
  rollupOptions: {
    input: {
      index: resolve(__dirname, 'index.html'),
      play: resolve(__dirname, 'play.html'),
    },
  },
}
```

---

#### U4. Mascot

**Goal:** Provide a CSS-drawn mascot with multiple states, speech bubbles, and lightweight animations.

**Requirements:** R11, R12

**Approach:**
- Build the mascot from CSS shapes.
- Add blink, wave, jump, happy, proud, and celebration states.
- Update the speech bubble based on learner progress.
- Keep the mascot inside the portal only.
- Ensure it stays within the viewport on smaller screens.

---

#### U5. Score tree/tower

**Goal:** Visualize learner progress; grow one level for every 50 points and animate changes.

**Requirements:** R10, R13, R14

**Approach:**
- Use SVG elements with CSS transitions.
- Calculate levels using `Math.floor(totalScore / 50)`, capped at 10 levels.
- Animate a `+N` star particle toward the score tree after score changes.
- Add a final star treatment at the maximum level.

---

### Phase 3: Integration

#### U6. 3D scene ↔ portal integration

**Goal:** Persist score at scene completion, return to the portal, and select scenes through the URL.

**Requirements:** R3, R4, R9

**Files:**
- Modify `src/main.ts`.
- Modify `play.html`.
- Modify `index.html`.

**Approach:**
- Read the scene ID with `new URLSearchParams(location.search).get('scene')`, defaulting to `restaurant`.
- Load the requested scene; if loading fails, display an error overlay with a `Back to scenes` action.
- At a terminal dialogue node, post `{ sceneId, score, completed: true }` to `/api/progress`.
- Show a `Back to scenes` action after completion.
- Navigate with `location.href = '/'` and reload current data from the portal.
- If saving progress fails, show a warning but do not prevent the learner from returning.

**End-to-end verification:**
1. Open the portal.
2. Start the restaurant scene.
3. Complete the speaking task.
4. Return to the portal.
5. Confirm the scene is marked complete, the score increases, the tree updates, and the next scene unlocks.

---

## System-Wide Impact

- **Page architecture:** changes from a single 3D entry page to a portal plus a 3D play page.
- **3D engine:** core `src/engine/` and scene logic remain unchanged; integration is concentrated around startup and completion in `src/main.ts`.
- **Backend:** adds scene and progress endpoints plus SQLite persistence.
- **Cross-page communication:** uses navigation and backend persistence rather than `postMessage`.

---

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Runtime scene imports may have ESM/CJS compatibility issues | Verify with the existing TypeScript/ESM server environment and handle import failures safely. |
| `better-sqlite3` requires a native binary | Use supported Node/platform builds and verify CI/deployment compatibility. |
| Multi-page Vite configuration adds build complexity | Keep only the portal and play entry points. |
| Child-friendly visuals could grow asset size | Prefer CSS and SVG assets over large images. |

---

## Documentation / Operational Notes

- Update `README.md` with portal vs. 3D launch instructions.
- Document backup expectations for persistent server data under `server/data/`.

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-26-kid-portal-requirements.md](../brainstorms/2026-04-26-kid-portal-requirements.md)
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3
