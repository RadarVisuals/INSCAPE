// src/store/slices/useSetupSlice.js

export const createSetupSlice = (set, get) => ({
  isUiVisible: true,
  toggleUi: () => set((state) => ({ isUiVisible: !state.isUiVisible })),

  // Rig-Aligned Stage & Actor Selection
  characterId: "abyssal_eye", // Text identifier matching actor folder name
  bgClippingMaskId: "moonpurple",   // Backdrop color name suffix
  bgPatternStyle: "stone",    // Pattern style prefix
  bgMountainId: 2,             // Front mountain asset ID
  bgMountainBackId: 3,         // Back mountain asset ID
});