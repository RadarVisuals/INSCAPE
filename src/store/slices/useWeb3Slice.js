// src/store/slices/useWeb3Slice.js

export const createWeb3Slice = (set, get) => ({
  // 9. Web3 Shockwave Customization Parameters
  shockwaveStrength: 1.0,     // Max displacement strength multiplier (0.0 - 2.0)
  shockwaveThickness: 160.0,  // Dynamic width of the expanding ring wavefront in pixels
  shockwaveDuration: 1.8,     // Single wave expansion lifetime duration in seconds
  shockwavePulseCount: 2,     // Number of cascading/overlapping waves fired on Web3 triggers (1 - 5)

  // 11. Web3 LSP1 Reaction State Parameters
  activeReaction: null,      
  reactionProgress: 0.0,     

  // Phase 2A Game State Updates
  gameState: "menu",          // "menu" or "gameplay"
  gameScore: 0,
  gameActiveWave: 1,
  playerHP: 100,
  playerShield: 100,
});