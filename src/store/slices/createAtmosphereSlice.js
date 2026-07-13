// src/store/slices/createAtmosphereSlice.js

export const createAtmosphereSlice = (set, get) => ({
  // 1. Aura / Glow & Cavern Reflection Control
  auraOpacity: 0.5,
  auraScale: 1.05,
  auraBlur: 20,
  auraPulseSpeed: 1.0,
  auraColorR: 235,
  auraColorG: 200,
  auraColorB: 150,
  cavernLightIntensity: 0.8, // Slider scale factor for dynamic cavern reflections

  // 2. Particulate Atmosphere (Particles)
  particleCount: 80,
  particleSpeed: 1.0,
  particleWind: 0,
  particleSway: 1.0,
  particleSize: 1.0,
  particleOpacity: 1.0,

  // 3. Volumetric Atmospheric Fog
  fogOpacity: 0.4,           // Starting alpha density for the volumetric noise
  fogSpeed: 1.0,             // Drift wind speed modifier
  fogColorR: 140,            // Fog RGB tint values
  fogColorG: 120,
  fogColorB: 180,
  fogSwaySpeed: 0.5,         // Vertical bobbing velocity
  fogSwayAmp: 20.0,          // Vertical bobbing range in pixels

  // 4. Parallax Background Layers & Scroll Speed
  bgScrollSpeed: 30.0,      
  bg2ParallaxSpeed: 1.8,    

  // 5. Retro Screen Overlays (Post-processing indicators)
  scanlineOpacity: 0.15,
  vignetteOpacity: 0.5,
});