// src/engine/systems/FlightDynamics.js

export class FlightDynamics {
  /**
   * Compiles coordinates, rotation tilts, and scale modifications on a per-frame basis.
   * @param {number} time - Elapsed execution time in seconds.
   * @param {Object} config - Normalized application state variables.
   * @param {boolean} isGlitchActive - Flag denoting if a peak glitch state is occurring.
   * @param {{x: number, y: number}} baselinePos - Dynamic target coordinates currently centered on the head [3].
   * @param {number} currentFlipScale - Horizontal scale factor supporting smooth rotational flipping [3].
   * @returns {Object} Target positions, rotation angles, and horizontal/vertical scales.
   */
  calculate(time, config, isGlitchActive, baselinePos, currentFlipScale) {
    const tFloat = time * config.floatSpeed;

    // Generate smooth hover pauses (plateaus) at wave extrema using smoothstep interpolation
    const rawWave = Math.sin(tFloat) * config.flyHoverPause;
    const clampedWave = Math.max(-1.0, Math.min(1.0, rawWave));
    
    // Map wave region down to [0.0, 1.0] for step translation
    const normProgress = clampedWave * 0.5 + 0.5; 
    const smoothProgress = normProgress * normProgress * (3.0 - 2.0 * normProgress);

    // Apply vertical displacement boundaries relative to the dynamic baseline [3]
    let y = baselinePos.y - (smoothProgress * config.floatAmpY * 1.5);
    
    // Apply horizontal sway relative to the dynamic baseline [3]
    let x = baselinePos.x + Math.cos(tFloat * 0.5) * config.floatAmpX;

    // Apply erratic noise coordinates if a screen shake action is active
    if (config.glitchShakeIntensity > 0 && isGlitchActive) {
      x += (Math.random() - 0.5) * config.glitchShakeIntensity;
      y += (Math.random() - 0.5) * config.glitchShakeIntensity;
    }

    // Process dynamic visual scale based on active coordinate height
    const scale = config.flyMinScale - (smoothProgress * (config.flyMinScale - config.flyMaxScale));

    // Process dynamic tilt (persistent bias angles + swaying)
    const tiltRad = config.flyTiltBias * (Math.PI / 180.0);
    const swayOsc = Math.sin(tFloat * 0.7) * (config.floatRotation * 0.5) * (Math.PI / 180.0);
    const rotation = tiltRad + swayOsc;

    return { 
      x, 
      y, 
      scale, 
      scaleX: scale * currentFlipScale, // Apply the horizontal rotation flip factor [3]
      rotation 
    };
  }
}