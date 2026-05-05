import { beachConfig } from './config.js';
import { animateBeachDecor, createBeachDecor } from './visuals.js';
import type { SceneModule } from '../../engine/runtime/SceneModule.js';

const beachScene: SceneModule = {
  id: 'beach',
  config: beachConfig,
  createVisuals: createBeachDecor,
  animateVisuals: animateBeachDecor,
};

export default beachScene;
