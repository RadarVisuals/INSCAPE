// src/store/slices/createGlitchSlice.js
import { DEFAULT_RENDER_CONFIG } from '../../config/renderConfig.defaults.js';
import { toFlatRenderParameters } from '../../config/normalizeRenderConfig.js';

// Flat aliases keep all existing effects editor controls stable.
export const createGlitchSlice = () => toFlatRenderParameters(DEFAULT_RENDER_CONFIG, 'effects');
