import { shopConfig } from './config.js';
import { shopHooks } from './hooks.js';
import { createShopDecor } from './visuals.js';
import type { SceneModule } from '../../engine/runtime/SceneModule.js';

const shopScene: SceneModule = {
  id: 'shop',
  config: shopConfig,
  hooks: shopHooks,
  createVisuals: createShopDecor,
};

export default shopScene;
