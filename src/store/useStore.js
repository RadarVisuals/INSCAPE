// src/store/useStore.js
import { create } from 'zustand';
import { createSetupSlice } from './slices/useSetupSlice';
import { createPhysicsSlice } from './slices/usePhysicsSlice';
import { createWeb3Slice } from './slices/useWeb3Slice';

export const useStore = create((set, get) => ({
  // Flatten slice definitions into the combined store [3]
  ...createSetupSlice(set, get),
  ...createPhysicsSlice(set, get),
  ...createWeb3Slice(set, get),
  
  /**
   * Central state mutator.
   * Modifies configuration parameters on the flattened store safely.
   * @param {string} key - Parameter field to modify.
   * @param {any} value - Assigned configuration value.
   */
  setParameter: (key, value) => set({ [key]: value }),
}));