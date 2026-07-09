// src/store/useStore.js
import { create } from 'zustand';

export const useStore = create((set) => ({
  isUiVisible: true,
  toggleUi: () => set((state) => ({ isUiVisible: !state.isUiVisible })),

  mousePos: { x: 0, y: 0 },
  setMousePos: (x, y) => set({ mousePos: { x, y } }),

  // Rig-Aligned Stage & Actor Selection
  characterId: "skull_reaper", // Text identifier matching actor folder name
  bgClippingMaskId: "black",   // Backdrop color name suffix
  bgPatternStyle: "bubble",     // Pattern style prefix
  bgMountainId: 1,             // Mountain asset sequential ID

  // 1. Motion Dynamics
  floatSpeed: 1.0,
  floatAmpX: 30,
  floatAmpY: 15,
  floatRotation: 2.0,

  // 2. Skull Pattern & Warp (Foreground)
  patternBottomScale: 1.0,
  patternTopScale: 1.0,
  warpIntensity: 20.0,
  warpSpeed: 1.0,

  // 3. Background Pattern & Warp (Independent)
  bgPatternBottomScale: 1.0,
  bgPatternTopScale: 1.0,
  bgWarpIntensity: 20.0,
  bgWarpSpeed: 1.0,

  // 4. Aura / Glow
  auraOpacity: 0.5,
  auraScale: 1.05,
  auraBlur: 20,
  auraPulseSpeed: 1.0,
  auraColorR: 235,
  auraColorG: 200,
  auraColorB: 150,

  // 5. Atmosphere (Particles)
  particleCount: 80,
  particleSpeed: 1.0,
  particleWind: 0,
  particleSway: 1.0,
  particleSize: 1.0,
  particleOpacity: 1.0,

  // 6. Atmospheric Parallax Layers
  bgScrollSpeed: 30.0,      
  bg2ParallaxSpeed: 1.8,    

  // 7. Screen Overlay
  scanlineOpacity: 0.15,
  vignetteOpacity: 0.5,

  // 8. Corruption / Glitch
  aberrationAmount: 0.0,
  aberrationSpeed: 0.0,
  aberrationGlitch: 0.0,
  glitchShakeIntensity: 0,
  flickerIntensity: 0.0,
  flickerSpeed: 1.0,

  // 9. Eye & Lid Dynamics
  eyelidTravel: 20.0,         
  blinkInterval: 5.0,        
  blinkSpeed: 1.0,           
  autoBlink: true,           
  eyelidManualProgress: 1.0, 
  pupilWander: 1.0,          
  pupilSaccade: 1.0,         
  pupilMouseInfluence: 1.0,  

  // 10. Web3 LSP1 Reaction State Parameters
  activeReaction: null,      
  reactionProgress: 0.0,     

  setParameter: (key, value) => set({ [key]: value }),
}));