import { DEFAULT_RENDER_CONFIG } from '../../config/renderConfig.defaults.js';
import { toFlatRenderParameters } from '../../config/normalizeRenderConfig.js';

// Flat aliases keep the current editor controls stable while RenderConfig
// becomes the authoritative engine-facing representation.
export const createPhenomenaSlice = () => toFlatRenderParameters(DEFAULT_RENDER_CONFIG, 'phenomena');
