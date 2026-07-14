// src/store/useStore.js
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createSetupSlice } from './slices/useSetupSlice';
import { createActorPhysicsSlice } from './slices/createActorPhysicsSlice';
import { createAtmosphereSlice } from './slices/createAtmosphereSlice';
import { createGlitchSlice } from './slices/createGlitchSlice';
import { createWeb3Slice } from './slices/useWeb3Slice';
import { createMutationRecipeSlice } from './slices/createMutationRecipeSlice';
import { createGrapplePrototypeSlice } from './slices/createGrapplePrototypeSlice';

export const useStore = create(subscribeWithSelector((set, get) => ({
  // Flatten slice definitions into the combined store
  ...createSetupSlice(set, get),
  ...createActorPhysicsSlice(set, get),
  ...createAtmosphereSlice(set, get),
  ...createGlitchSlice(set, get),
  ...createWeb3Slice(set, get),
  ...createMutationRecipeSlice(set, get),
  ...createGrapplePrototypeSlice(set, get),
  
  /**
   * Central state mutator.
   * Modifies configuration parameters on the flattened store safely.
   * @param {string} key - Parameter field to modify.
   * @param {any} value - Assigned configuration value.
   */
  setParameter: (key, value) => set({ [key]: value }),
})));
