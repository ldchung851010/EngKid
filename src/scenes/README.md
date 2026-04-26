# Scene Authoring Contract

Each scene is a self-contained directory under `src/scenes/<scene-id>/`.

Required files:

- `config.ts` exports a `SceneConfig`
- `hooks.ts` exports optional scene hooks
- `visuals.ts` exports optional Three.js decorative geometry
- `index.ts` exports the default `SceneModule`

The runtime auto-discovers `src/scenes/*/index.ts`. To add a scene, copy an
existing scene directory, rename the exports, and update the config content.
No engine or app entry file should need changes.

The scene config owns:

- map dimensions and block layers
- NPC position, voice, and dialogue tree
- task definitions and target intents
- optional camera start position
- optional sky/fog environment settings

The scene hooks are intentionally small:

- `onBeforeDialogue`
- `onIntentMatched`
- `onTaskComplete`

Keep scene-specific behavior in the scene directory. If a new scene cannot be
implemented without changing engine code, treat that as an engine extensibility
issue and add the smallest stable engine capability needed by more than one
scene.
