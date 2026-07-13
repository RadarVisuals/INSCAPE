// src/store/slices/useSetupSlice.js
export const createSetupSlice = (set, get) => ({
  isUiVisible: true,
  toggleUi: () => set((state) => ({ isUiVisible: !state.isUiVisible })),

  subjectMode: "actor",
  characterId: "abyssal_eye", 
  creatorCharacterId: "01",
  creatorPatternId: "patchedzebra",
  creatorPaletteId: "basic_purple",
  bgClippingMaskId: "moonpurple",   
  bgPatternStyle: "digitalblob",    
  bgMountainId: 2,             
  bgMountainBackId: 3,         
});
