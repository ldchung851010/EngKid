import { homeConfig } from './config.js';
import { homeHooks } from './hooks.js';
import { createHomeDecor } from './visuals.js';
import type { SceneModule } from '../../engine/runtime/SceneModule.js';

const homeScene: SceneModule = {
  id: 'home',
  config: homeConfig,
  hooks: homeHooks,
  createVisuals: createHomeDecor,
};

export default homeScene;
