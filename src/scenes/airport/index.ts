import { airportConfig } from './config.js';
import { createAirportDecor } from './visuals.js';
import type { SceneModule } from '../../engine/runtime/SceneModule.js';

const airportScene: SceneModule = {
  id: 'airport',
  config: airportConfig,
  createVisuals: createAirportDecor,
};

export default airportScene;
