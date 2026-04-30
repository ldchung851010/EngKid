import { parkConfig } from './config.js';
import { parkHooks } from './hooks.js';
import { animateParkDecor, createParkDecor } from './visuals.js';
import type { SceneModule } from '../../engine/runtime/SceneModule.js';

const parkScene: SceneModule = {
  id: 'park',
  config: parkConfig,
  hooks: parkHooks,
  createVisuals: createParkDecor,
  animateVisuals: animateParkDecor,
};

export default parkScene;
