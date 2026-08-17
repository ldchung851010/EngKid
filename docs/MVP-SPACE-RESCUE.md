# EngKid MVP — Space Rescue Lab

This branch contains the first playable vertical slice for EngKid.

## Goal

Validate two hypotheses with one small 3D room:

1. Children want to explore, speak and finish the mission.
2. Children move through Understand → Think → Formulate → Interact → Feedback → Transfer instead of only repeating model sentences.

## Play flow

1. **Listen & Explore** — listen to NOVA and find Mars.
2. **Ask the Robot** — ask questions to locate a missing rocket battery.
3. **Prepare the Rocket** — choose three supplies and explain why each is useful.
4. **Transfer Challenge** — destination changes to the Moon; adapt the plan and explain the new choice.

## Adaptive tutoring

Scaffold levels are S0–S4. Two consecutive failures raise help by one level; two consecutive successes reduce help by one level. The app favors visual/semantic hints before full language models.

## Data

The prototype stores transcripts, scaffold evidence, concept mastery and session events locally in the browser. It does not intentionally store raw microphone recordings. Parent View can export the current evidence as JSON.

## Run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:5173/space-rescue.html`.

## Build

```bash
npm run build
```

The branch includes a GitHub Pages workflow so the same static build can be used as an iPad PWA.
