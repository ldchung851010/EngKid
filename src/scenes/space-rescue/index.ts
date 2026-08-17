import type { SceneModule } from '../../engine/runtime/SceneModule.js';
import { spaceRescueConfig } from './config.js';
import { spaceRescueHooks } from './hooks.js';
import { animateSpaceRescueDecor, createSpaceRescueDecor } from './visuals.js';

const spaceRescueScene: SceneModule = {
  id: 'space-rescue',
  config: spaceRescueConfig,
  hooks: spaceRescueHooks,
  createVisuals: createSpaceRescueDecor,
  animateVisuals: animateSpaceRescueDecor,
};

export default spaceRescueScene;
