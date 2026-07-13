// src/store/slices/createActorPhysicsSlice.js

export const createActorPhysicsSlice = (set, get) => ({
  // 1. Motion & Hover Dynamics
  floatSpeed: 1.0,
  floatAmpX: 30,
  floatAmpY: 50,
  floatRotation: 2.0,

  // Flight & Hover parameters
  flyMinScale: 0.7,       // Scale at lowest point of flight (closer)
  flyMaxScale: 0.2,       // Scale at highest peak of flight (further)
  flyHoverPause: 1.0,     // Hover pause factor (1.0 = smooth sine, 5.0 = flat plateau pauses)
  flyTiltBias: 3.0,       // Persistent tilt bias in degrees

  // 2. Skull Pattern & Warp (Foreground)
  patternBottomScale: 1.0,
  patternTopScale: 1.0,
  warpIntensity: 20.0,
  warpSpeed: 1.0,

  // Creator-only mutation experiment
  mutationMode: 'none',
  mutationAxisX: 0.5,
  mutationAxisY: 0.5,
  mutationSourceX: 'left',
  mutationSourceY: 'top',
  mutationPatternMode: 'symbiosis',
  mutationRotation: 0,

  // 3. Eye & Lid Dynamics
  eyelidTravel: 20.0,         
  blinkInterval: 5.0,        
  blinkSpeed: 1.0,           
  autoBlink: true,           
  eyelidManualProgress: 1.0, 
  pupilWander: 1.0,          
  pupilSaccade: 1.0,         
  pupilMouseInfluence: 1.0,  

  // 4. Searchlight Customisation
  searchlightActive: false,
  searchlightWidth: 0.2,     // Beam width scale
  searchlightLength: 1.0,    // Max beam extension
  searchlightRadius: 150,    // Starting emission radius along character's perimeter
  searchlightColorR: 255,    // RGB values
  searchlightColorG: 255,
  searchlightColorB: 255,
});
