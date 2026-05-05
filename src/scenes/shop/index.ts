import { shopConfig } from './config.js';
import { createShopDecor } from './visuals.js';
import type { SceneModule } from '../../engine/runtime/SceneModule.js';

const shopScene: SceneModule = {
  id: 'shop',
  config: shopConfig,
  createVisuals: createShopDecor,
};

export default shopScene;
