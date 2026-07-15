// src/store/slices/createAtmosphereSlice.js

export const createAtmosphereSlice = (set, get) => ({
  // 1. Particulate Atmosphere (Particles)
  particleCount: 80,
  particleSpeed: 1.0,
  particleWind: 0,
  particleSway: 1.0,
  particleSize: 1.0,
  particleOpacity: 1.0,

  // 2. Volumetric Atmospheric Fog
  fogOpacity: 0.4,           // Starting alpha density for the volumetric noise
  fogSpeed: 1.0,             // Drift wind speed modifier
  fogColorR: 140,            // Fog RGB tint values
  fogColorG: 120,
  fogColorB: 180,
  fogSwaySpeed: 0.5,         // Vertical bobbing velocity
  fogSwayAmp: 20.0,          // Vertical bobbing range in pixels

  // 3. Parallax Background Layers & Scroll Speed
  bgScrollSpeed: 30.0,      
  bg2ParallaxSpeed: 1.8,    

  // 4. Retro Screen Overlays (Post-processing indicators)
  scanlineOpacity: 0.15,
  vignetteOpacity: 0.5,
});
