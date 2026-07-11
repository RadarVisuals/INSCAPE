// src/store/slices/usePhysicsSlice.js

export const createPhysicsSlice = (set, get) => ({
  // gameplay active metrics and player statistics
  gameState: "menu", // "menu" or "gameplay"
  playerHP: 100,
  playerShield: 100,
  gameScore: 0,
  gameActiveWave: 1,

  // 1. Motion Dynamics
  floatSpeed: 1.0,
  floatAmpX: 30,
  floatAmpY: 15,
  floatRotation: 2.0,

  // Custom Flight and Hover parameters
  flyMinScale: 0.3,       // Scale at lowest point of flight
  flyMaxScale: 0.3,       // Scale at highest peak of flight
  flyHoverPause: 1.0,     // Hover pause factor (1.0 = smooth sine, up to 5.0 = flat plateau pauses)
  flyTiltBias: 3.0,       // Persistent tilt bias in degrees

  // 2. Skull Pattern & Warp (Foreground)
  patternBottomScale: 1.0,
  patternTopScale: 1.0,
  warpIntensity: 20.0,
  warpSpeed: 1.0,

  // 3. Background Pattern & Warp (Independent)
  bgPatternBottomScale: 1.0,
  bgPatternTopScale: 1.0,
  bgWarpIntensity: 35.0,
  bgWarpSpeed: 1.0,

  // 4. Aura / Glow & Cavern Reflection Control
  auraOpacity: 0.5,
  auraScale: 0.5,
  auraBlur: 20,
  auraPulseSpeed: 1.0,
  auraColorR: 235,
  auraColorG: 200,
  auraColorB: 150,
  cavernLightIntensity: 0.8, // Slider scale factor for dynamic cavern reflections

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

  // 8. Corruption / Glitch & Echoing Phase Trails
  aberrationAmount: 0.0,
  aberrationSpeed: 0.0,
  aberrationGlitch: 0.0,
  glitchShakeIntensity: 0,
  flickerIntensity: 0.0,
  flickerSpeed: 1.0,
  
  // Phase Trail Control Parameters
  trailCount: 3,             // Total active spectral trails (0 - 3)
  trailSpacing: 5,           // Delayed spacing of historical coordinates in frames
  trailManualAlpha: 0.0,     // Static override opacity to manually customize/test trails
  trailGlitchInfluence: 0.6, // Relative opacity scaling factor during spikes and shake actions

  // 10. Eye & Lid Dynamics
  eyelidTravel: 20.0,         
  blinkInterval: 5.0,        
  blinkSpeed: 1.0,           
  autoBlink: true,           
  eyelidManualProgress: 1.0, 
  pupilWander: 1.0,          
  pupilSaccade: 1.0,         
  pupilMouseInfluence: 1.0,  

  // 11. Searchlight Customisation State
  searchlightActive: true,
  searchlightWidth: 0.2,     // Beam width scale
  searchlightLength: 1.0,    // Max beam extension
  searchlightRadius: 120,    // Starting emission radius along character's perimeter
  searchlightColorR: 255,    // RGB values
  searchlightColorG: 255,
  searchlightColorB: 255,
});