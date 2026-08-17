# Kid-Friendly Portal, Scene Selection, and Progress — Requirements

## Problem

The first engine prototype opened directly into one hard-coded 3D scene. It had no child-friendly entry experience, scene selection, persistent progress view, or clear journey between learning situations.

The product needs a lightweight 2D portal that helps a child understand what to do next, enter an available scene, return after a mission, and see visible progress.

## Actors

### A1. Child learner

A child browses large scene cards, starts an unlocked 3D learning scene, completes missions, returns to the portal, and sees updated progress.

### A2. Mascot/guide

A friendly character provides short English guidance and positive feedback. It belongs to the portal and does not need to follow the child into the 3D world.

## Core Flows

### F1. First visit

1. Open the portal.
2. Show the mascot and a simple welcome message.
3. Load scene metadata and learner progress.
4. Show unlocked scenes clearly and locked scenes visually disabled.
5. Highlight the most obvious starting action.

Outcome: a young child can identify what to tap without parent explanation.

### F2. Enter a scene and return

1. Tap an unlocked scene card.
2. Play a short transition.
3. Open the corresponding 3D scene.
4. Complete a meaningful English mission.
5. Persist the learner result.
6. Return to the portal.
7. Refresh completion, score, collection, and unlock visuals.

Outcome: the child sees that actions inside the learning scene changed visible progress outside it.

### F3. Unlock the next experience

1. Complete the prerequisite scene/mission.
2. Recompute unlock state.
3. Animate the newly available scene.
4. Show a short English congratulatory message.

Outcome: the portal makes progression understandable without a separate course-management interface.

## Requirements

### Portal UI

- **R1.** The portal is a 2D HTML interface with large rounded cards, bright child-friendly colors, readable typography, and generous touch targets.
- **R2.** Each scene card shows name, one-line description, completion state, and relevant score/progress information.
- **R3.** Tapping an unlocked card plays a small transition and enters the correct 3D scene.
- **R4.** Returning from a completed scene refreshes visible learner state automatically.

### Scene metadata

- **R5.** `GET /api/scenes` or an equivalent static source provides scene `id`, `name`, `description`, CEFR level, and other non-user metadata.
- **R6.** Scenes can be ordered by intended progression such as CEFR level and prerequisites. Locked scenes use a clear lock/disabled treatment.

### Progress

- **R7.** Persist scene completion, score, and last-played time for the current learner context.
- **R8.** Portal progress components derive total score and per-scene state from learner data.
- **R9.** Finishing a 3D mission updates learner progress before or while returning to the portal.
- **R10.** Progress changes may use a small celebration animation such as a flying star or growing progress object.

The historical prototype used server SQLite. Current EngKid uses browser-local learner data for the MVP, so the behavioral requirement is persistence and correct ownership rather than a specific database.

### Mascot

- **R11.** A mascot appears in a consistent portal location and supports several lightweight states such as idle, greeting, celebration, and progress encouragement.
- **R12.** The mascot remains a portal concern rather than a 3D-scene requirement.

Example English messages:

- “Pick a scene to start learning!”
- “Great job! A new mission is open!”
- “You're halfway there! Keep going!”
- “Amazing! You completed everything!”

### Progress visualization

- **R13.** Show a visual progress object such as a tree or tower that grows at score milestones.
- **R14.** When a milestone is crossed, animate the new level so progress feels tangible.

### Offline/degraded behavior

- **R15.** If a remote backend is unavailable, locally available scene/progress information should still render where possible. Missing AI/server capabilities should be explained without making the whole portal unusable.

## Acceptance Examples

### AE1 — Clear starting state

The portal opens with a visible score/progress area and several scene cards. The first playable scene is clearly available, later scenes are visibly locked, and the mascot says, “Pick a scene to start!”

### AE2 — Complete and return

The child enters a scene, completes the mission, returns, and immediately sees a completion indicator and updated progress. If the completion unlocks another scene, that scene becomes visibly available.

### AE3 — Milestone animation

A score increase crosses a configured progress-tree milestone. The next level grows/appears with a short animation.

### AE4 — Persistence

Closing and reopening the browser preserves progress for the same learner/browser context.

## Success Criteria

- An eight-year-old can open the portal, enter a scene, complete a mission, and understand the changed portal state without parent guidance.
- Within a few seconds, the visual design communicates that the product is a game-like learning experience for children.
- Progress remains consistent across refreshes in the intended learner context.
- The mascot supports clarity and motivation without becoming the main task.
- Touch targets and layout work reliably on iPad Safari for the current EngKid MVP.

## Out of Scope

- account login or multiple child profiles;
- parent analytics dashboard;
- social leaderboards or friend systems;
- a content marketplace;
- full curriculum-management functionality;
- paid subscriptions or scene distribution/version management inside the portal.

Internationalization was a historical deferred item. For the current English-learning MVP, **all child-facing interface and instructional text should be English-only unless a future product requirement explicitly introduces another language.**

## Design Decisions

### Cards, mascot, and progress visualization belong together

These three elements form one portal experience and should share the same layout and visual system rather than being designed as unrelated widgets.

### Scene metadata is separate from learner state

Scene identity and educational metadata can come from static/server content. Completion, score, and unlock state should be derived from the learner's own data.

### Visual progress over numbers alone

A tree/tower gives a child a sense of building something over time. The implementation can remain lightweight with CSS/SVG rather than a heavy animation framework.

### Child-friendly interaction first

The portal should prefer obvious touch/click actions, short English copy, and large targets. Small settings and parent-oriented data tools should not compete with the primary scene cards.

## Risks and Follow-up

- Test the portal on real iPad viewport sizes and orientations.
- Ensure locked/unlocked meaning is communicated by more than color alone.
- Keep mascot messages short enough for beginner English learners.
- Avoid excessive animation that slows navigation or distracts from learning.
- Validate that progression logic does not accidentally block useful free exploration.
