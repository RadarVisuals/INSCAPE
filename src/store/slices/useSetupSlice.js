// src/store/slices/useSetupSlice.js
import { DEFAULT_RENDER_CONFIG } from '../../config/renderConfig.defaults.js';
import { toFlatRenderParameters } from '../../config/normalizeRenderConfig.js';

const canonicalSetupAliases = toFlatRenderParameters(DEFAULT_RENDER_CONFIG);

export const createSetupSlice = (set, get) => ({
  isUiVisible: true,
  toggleUi: () => set((state) => ({ isUiVisible: !state.isUiVisible })),

  characterId: canonicalSetupAliases.characterId,
  environmentType: canonicalSetupAliases.environmentType,
  environmentShaderId: canonicalSetupAliases.environmentShaderId,
  bgClippingMaskId: canonicalSetupAliases.bgClippingMaskId,
  bgPatternStyle: canonicalSetupAliases.bgPatternStyle,
  bgMountainId: canonicalSetupAliases.bgMountainId,
  bgMountainBackId: canonicalSetupAliases.bgMountainBackId
});
