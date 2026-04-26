import { schoolConfig } from './config.js';
import { schoolHooks } from './hooks.js';
import { createSchoolDecor } from './visuals.js';
import type { SceneModule } from '../../engine/runtime/SceneModule.js';

const schoolScene: SceneModule = {
  id: 'school',
  config: schoolConfig,
  hooks: schoolHooks,
  createVisuals: createSchoolDecor,
};

export default schoolScene;
