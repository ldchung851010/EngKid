import { farmConfig } from './config.js';
import { farmHooks } from './hooks.js';
import { animateFarmDecor, createFarmDecor } from './visuals.js';
import type { SceneModule } from '../../engine/runtime/SceneModule.js';

const farmScene: SceneModule = {
  id: 'farm',
  config: farmConfig,
  hooks: farmHooks,
  createVisuals: createFarmDecor,
  animateVisuals: animateFarmDecor,
};

export default farmScene;
