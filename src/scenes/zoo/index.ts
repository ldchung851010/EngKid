import { zooConfig } from './config.js';
import { zooHooks } from './hooks.js';
import { createZooDecor } from './visuals.js';
import type { SceneModule } from '../../engine/runtime/SceneModule.js';

const zooScene: SceneModule = {
  id: 'zoo',
  config: zooConfig,
  hooks: zooHooks,
  createVisuals: createZooDecor,
};

export default zooScene;
