import { restaurantConfig } from './config.js';
import { restaurantHooks } from './hooks.js';
import { createRestaurantDecor } from './visuals.js';
import type { SceneModule } from '../../engine/runtime/SceneModule.js';

const restaurantScene: SceneModule = {
  id: 'restaurant',
  config: restaurantConfig,
  hooks: restaurantHooks,
  createVisuals: createRestaurantDecor,
};

export default restaurantScene;
