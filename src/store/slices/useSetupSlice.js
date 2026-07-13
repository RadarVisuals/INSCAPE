// src/store/slices/useSetupSlice.js
export const createSetupSlice = (set, get) => ({
  isUiVisible: true,
  toggleUi: () => set((state) => ({ isUiVisible: !state.isUiVisible })),

  subjectMode: "actor",
  characterId: "abyssal_eye", 
  creatorCharacterId: "01",
  creatorPatternId: "patchedzebra",
  creatorPaletteId: "basic_purple",
  creatorBasePaletteBId: "basic_hotpink",
  creatorPattern1PaletteAId: "basic_black",
  creatorPattern1PaletteBId: "basic_pastelpurple",
  creatorPattern2Id: "electric",
  creatorPattern2PaletteAId: "basic_darkblue",
  creatorPattern2PaletteBId: "basic_lightblue",
  bgClippingMaskId: "moonpurple",   
  bgPatternStyle: "digitalblob",    
  bgMountainId: 2,             
  bgMountainBackId: 3,         
});
