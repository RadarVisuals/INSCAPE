// src/store/slices/createAtmosphereSlice.js

import { DEFAULT_RENDER_CONFIG } from '../../config/renderConfig.defaults.js';
import { toFlatRenderParameters } from '../../config/normalizeRenderConfig.js';

const sceneAliases = toFlatRenderParameters(DEFAULT_RENDER_CONFIG, 'scene');

export const createAtmosphereSlice = (set, get) => ({
  // Flat aliases keep the current scene editor stable while RenderConfig remains authoritative.
  ...sceneAliases,

  // Retro Screen Overlays remain in the future Effects phase.
  scanlineOpacity: 0.15,
  vignetteOpacity: 0.5,
});
