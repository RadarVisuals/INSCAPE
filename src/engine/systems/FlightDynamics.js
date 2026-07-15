// src/engine/systems/FlightDynamics.js

export class FlightDynamics {
  /**
   * Compiles coordinates, rotation tilts, and scale modifications on a per-frame basis.
   * @param {number} elapsed - Elapsed execution time in seconds.
   * @param {Object} config - Actor motion configuration.
   * @param {number} glitchShakeIntensity - Current runtime shake strength.
   * @param {boolean} isGlitchActive - Flag denoting if a peak glitch state is occurring.
   * @param {{x: number, y: number}} baselinePos - Dynamic target coordinates currently centered on the head.
   * @param {number} currentFlipScale - Horizontal scale factor supporting smooth rotational flipping.
   * @param {number} canvasHeight - Total visible viewport height in local coordinate units.
   * @returns {Object} Target positions, rotation angles, and horizontal/vertical scales.
   */
  calculate(elapsed, config, glitchShakeIntensity, isGlitchActive, baselinePos, currentFlipScale, canvasHeight = 1000) {
    const tFloat = elapsed * config.floatSpeed;

    // Generate smooth hover pauses (plateaus) at wave extrema using smoothstep interpolation
    const rawWave = Math.sin(tFloat) * config.flyHoverPause;
    const clampedWave = Math.max(-1.0, Math.min(1.0, rawWave));
    
    // Map wave region down to [0.0, 1.0] for step translation
    const normProgress = clampedWave * 0.5 + 0.5; 
    const smoothProgress = normProgress * normProgress * (3.0 - 2.0 * normProgress);

    // Apply vertical displacement boundaries relative to the dynamic baseline
    let y = baselinePos.y - (smoothProgress * config.floatAmpY * 1.5);
    
    // Apply horizontal sway relative to the dynamic baseline
    let x = baselinePos.x + Math.cos(tFloat * 0.5) * config.floatAmpX;

    // Apply erratic noise coordinates if a screen shake action is active
    if (glitchShakeIntensity > 0 && isGlitchActive) {
      x += (Math.random() - 0.5) * glitchShakeIntensity;
      y += (Math.random() - 0.5) * glitchShakeIntensity;
    }

    // --- Dynamic Height-Based Scaling ---
    // The top of the visible screen is at -halfHeight, and the bottom is at +halfHeight
    const halfHeight = canvasHeight / 2;
    const clampedY = Math.max(-halfHeight, Math.min(halfHeight, baselinePos.y));
    
    // Convert coordinate to a clean normalized [0.0, 1.0] ratio 
    // -halfHeight (top of screen) maps to 0.0, halfHeight (bottom of screen) maps to 1.0
    const heightRatio = (clampedY + halfHeight) / canvasHeight;

    // Interpolate: flyMaxScale (smaller, further away / top) up to flyMinScale (closer / bottom)
    const scale = config.flyMaxScale + heightRatio * (config.flyMinScale - config.flyMaxScale);

    // Process dynamic tilt (persistent bias angles + swaying)
    const tiltRad = config.flyTiltBias * (Math.PI / 180.0);
    const swayOsc = Math.sin(tFloat * 0.7) * (config.floatRotation * 0.5) * (Math.PI / 180.0);
    const rotation = tiltRad + swayOsc;

    return { 
      x, 
      y, 
      scale, 
      scaleX: scale * currentFlipScale, // Apply the horizontal rotation flip factor
      rotation 
    };
  }
}
