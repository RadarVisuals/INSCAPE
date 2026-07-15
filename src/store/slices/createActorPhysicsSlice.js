// src/store/slices/createActorPhysicsSlice.js
import { DEFAULT_RENDER_CONFIG } from '../../config/renderConfig.defaults.js';
import { toFlatRenderParameters } from '../../config/normalizeRenderConfig.js';

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

  // Actor geometry and warp defaults come from the render contract.
  ...toFlatRenderParameters(DEFAULT_RENDER_CONFIG, 'actor'),

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
