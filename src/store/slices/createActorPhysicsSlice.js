// src/store/slices/createActorPhysicsSlice.js
import { DEFAULT_RENDER_CONFIG } from '../../config/renderConfig.defaults.js';
import { toFlatRenderParameters } from '../../config/normalizeRenderConfig.js';

export const createActorPhysicsSlice = (set, get) => ({
  // Flat aliases keep the existing editor stable while RenderConfig remains authoritative.
  ...toFlatRenderParameters(DEFAULT_RENDER_CONFIG, 'actor')
});
