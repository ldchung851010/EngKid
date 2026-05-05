import { schoolConfig } from './config.js';
import { createSchoolDecor } from './visuals.js';
import type { SceneModule } from '../../engine/runtime/SceneModule.js';

const schoolScene: SceneModule = {
  id: 'school',
  config: schoolConfig,
  createVisuals: createSchoolDecor,
};

export default schoolScene;
