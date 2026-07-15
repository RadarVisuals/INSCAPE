// src/store/slices/useSetupSlice.js
export const createSetupSlice = (set, get) => ({
  isUiVisible: true,
  toggleUi: () => set((state) => ({ isUiVisible: !state.isUiVisible })),

  characterId: "abyssal_eye", 
  bgClippingMaskId: "moonpurple",   
  bgPatternStyle: "digitalblob",    
  bgMountainId: 2,             
  bgMountainBackId: 3,         
});
