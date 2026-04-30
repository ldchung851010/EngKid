import { hospitalConfig } from './config.js';
import { hospitalHooks } from './hooks.js';
import { createHospitalDecor } from './visuals.js';
import type { SceneModule } from '../../engine/runtime/SceneModule.js';

const hospitalScene: SceneModule = {
  id: 'hospital',
  config: hospitalConfig,
  hooks: hospitalHooks,
  createVisuals: createHospitalDecor,
};

export default hospitalScene;
