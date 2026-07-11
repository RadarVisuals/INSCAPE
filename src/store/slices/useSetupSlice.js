// src/store/slices/useSetupSlice.js

export const createSetupSlice = (set, get) => ({
  isUiVisible: true,
  toggleUi: () => set((state) => ({ isUiVisible: !state.isUiVisible })),

  // Rig-Aligned Stage & Actor Selection
  characterId: "skull_reaper", // Text identifier matching actor folder name
  bgClippingMaskId: "black",   // Backdrop color name suffix
  bgPatternStyle: "bubble",    // Pattern style prefix
  bgMountainId: 1,             // Front mountain asset ID
  bgMountainBackId: 2,         // Back mountain asset ID
});