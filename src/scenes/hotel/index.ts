import { hotelConfig } from './config.js';
import { hotelHooks } from './hooks.js';
import { createHotelDecor } from './visuals.js';
import type { SceneModule } from '../../engine/runtime/SceneModule.js';

const hotelScene: SceneModule = {
  id: 'hotel',
  config: hotelConfig,
  hooks: hotelHooks,
  createVisuals: createHotelDecor,
};

export default hotelScene;
