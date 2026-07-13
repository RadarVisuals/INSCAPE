// src/store/slices/createGlitchSlice.js

export const createGlitchSlice = (set, get) => ({
  // 1. Background Pattern Warp (Independent)
  bgPatternBottomScale: 1.0,
  bgPatternTopScale: 1.0,
  bgWarpIntensity: 20.0,
  bgWarpSpeed: 1.0,

  // 2. Chromatic Aberration & Visual Shakes
  aberrationAmount: 0.0,
  aberrationSpeed: 0.0,
  aberrationGlitch: 0.0,
  glitchShakeIntensity: 0,
  flickerIntensity: 0.0,
  flickerSpeed: 1.0,
  
  // 3. Spectral Phase Trail Control
  trailCount: 3,             // Total active spectral trails (0 - 3)
  trailSpacing: 5,           // Delayed spacing of historical coordinates in frames
  trailManualAlpha: 0.0,     // Static override opacity to manually customize/test trails
  trailGlitchInfluence: 0.6, // Relative opacity scaling factor during spikes and shake actions
});