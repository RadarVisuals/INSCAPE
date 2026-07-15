// src/store/useStore.js
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createSetupSlice } from './slices/useSetupSlice.js';
import { createActorPhysicsSlice } from './slices/createActorPhysicsSlice.js';
import { createAtmosphereSlice } from './slices/createAtmosphereSlice.js';
import { createGlitchSlice } from './slices/createGlitchSlice.js';
import { createWeb3Slice } from './slices/useWeb3Slice.js';
import { createActorPresetSlice } from './slices/createActorPresetSlice.js';
import { createPhenomenaSlice } from './slices/createPhenomenaSlice.js';
import {
  createRenderConfigFromFlatState,
  normalizeRenderConfig,
  toFlatRenderParameters,
  updateRenderConfigParameter
} from '../config/normalizeRenderConfig.js';

export const useStore = create(subscribeWithSelector((set, get) => {
  const initialState = {
    ...createSetupSlice(set, get),
    ...createActorPhysicsSlice(set, get),
    ...createAtmosphereSlice(set, get),
    ...createGlitchSlice(set, get),
    ...createWeb3Slice(set, get),
    ...createActorPresetSlice(set, get),
    ...createPhenomenaSlice(set, get)
  };

  return {
    ...initialState,
    renderConfig: createRenderConfigFromFlatState(initialState),

    applyRenderConfig: (candidate) => set(() => {
      const renderConfig = normalizeRenderConfig(candidate);
      return { renderConfig, ...toFlatRenderParameters(renderConfig) };
    }),

    applyRenderParameters: (values) => set((state) => {
      let renderConfig = state.renderConfig;
      const safeValues = {};
      for (const [key, value] of Object.entries(values)) {
        const renderUpdate = updateRenderConfigParameter(renderConfig, key, value);
        if (renderUpdate) {
          renderConfig = renderUpdate.renderConfig;
          safeValues[key] = renderUpdate.value;
        } else if (Object.prototype.hasOwnProperty.call(state, key)) {
          safeValues[key] = value;
        }
      }
      return { ...safeValues, renderConfig };
    }),
  
  /**
   * Central state mutator.
   * Modifies configuration parameters on the flattened store safely.
   * @param {string} key - Parameter field to modify.
   * @param {any} value - Assigned configuration value.
   */
    setParameter: (key, value) => set((state) => {
      const renderUpdate = updateRenderConfigParameter(state.renderConfig, key, value);
      if (renderUpdate) {
        return { [key]: renderUpdate.value, renderConfig: renderUpdate.renderConfig };
      }
      return { [key]: value };
    })
  };
}));
