// src/engine/systems/EffectsSystem.js
import { BlurFilter, ColorMatrixFilter } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';

export class EffectsSystem {
  constructor() {
    // 1. Instantiate filter instances
    this.rgbSplitFilter = new RGBSplitFilter({
      red: { x: 0, y: 0 },
      green: { x: 0, y: 0 },
      blue: { x: 0, y: 0 }
    });
    this.auraBlurFilter = new BlurFilter({ strength: 20 });
    this.auraBlurFilter.padding = 100; // Prevent harsh bounding box edge clipping during large blur pulses

    this.colorMatrix = new ColorMatrixFilter();

    // Store target references
    this.targets = {
      headContainer: null,
      auraSprite: null,
      baseSprite: null,
      mountainReflector: null,
      mountainBackReflector: null,
      ceilingReflector: null
    };
  }

  /**
   * Connects the initialized filters to their respective target display objects.
   * @param {Object} targets - Target display objects to receive the filters and updates.
   * @param {Container} targets.headContainer - Container for head assets.
   * @param {Sprite} targets.auraSprite - Background glow/aura sprite.
   * @param {Sprite} targets.baseSprite - Skull base color sprite.
   * @param {DisplayObject} targets.mountainReflector - Foreground mountain reflection layer.
   * @param {DisplayObject} targets.mountainBackReflector - Background mountain reflection layer.
   * @param {DisplayObject} targets.ceilingReflector - Background pattern/ceiling reflection layer.
   */
  attach(targets) {
    this.targets = { ...this.targets, ...targets };

    if (this.targets.headContainer) {
      this.targets.headContainer.filters = [this.rgbSplitFilter];
    }
    if (this.targets.auraSprite) {
      // Color matrix is removed here so the aura preserves the rich native colors of mask.webp
      this.targets.auraSprite.filters = [this.auraBlurFilter];
    }
    if (this.targets.baseSprite) {
      this.targets.baseSprite.filters = [this.colorMatrix];
    }
  }

  /**
   * Updates visual parameters on a per-frame basis.
   * @param {number} time - Elapsed time in seconds.
   * @param {Object} state - State from useStore.
   * @returns {Object} Glitch state metrics for the main engine (such as screen shake).
   */
  update(time, state) {
    const metrics = {
      isGlitched: false,
      currentSplit: state.aberrationAmount
    };

    // 1. RGB Split / Glitch Calculations
    if (state.aberrationSpeed > 0) {
      const pulseWave = Math.sin(time * state.aberrationSpeed * 3);
      metrics.currentSplit = Math.abs(pulseWave) * state.aberrationAmount;

      if (state.aberrationGlitch > 0 && Math.random() < (0.008 * state.aberrationGlitch)) {
        metrics.currentSplit = state.aberrationAmount * (1.5 + Math.random() * 1.5);
        metrics.isGlitched = true;
      }
    }
    this.rgbSplitFilter.red = { x: metrics.currentSplit, y: 0 };
    this.rgbSplitFilter.blue = { x: -metrics.currentSplit, y: 0 };

    // 2. Color Matrix / Strobe Calculations
    let flickerFactor = 1.0;
    if (this.targets.baseSprite) {
      if (state.flickerIntensity > 0) {
        const strobeTime = time * state.flickerSpeed * 45;
        const waveValue = Math.sin(strobeTime) * Math.sin(strobeTime * 2.3) * Math.cos(strobeTime * 0.85);
        const triggerThreshold = 1.0 - state.flickerIntensity;
        this.colorMatrix.reset();

        if (waveValue > triggerThreshold) {
          this.colorMatrix.brightness(1.8, false);
          this.colorMatrix.contrast(1.5, true);
          flickerFactor = 1.8;
        } else if (waveValue < -triggerThreshold) {
          this.colorMatrix.brightness(0.05, false);
          flickerFactor = 0.05;
        } else {
          const randoB = 1.0 + (Math.random() - 0.5) * 0.15 * state.flickerIntensity;
          this.colorMatrix.brightness(randoB, false);
          flickerFactor = randoB;
        }
      } else {
        this.colorMatrix.reset();
      }
    }

    // 3. Aura Blur / Dimension Pulse Calculations
    const auraPulse = Math.sin(time * state.auraPulseSpeed * 2.0) * 0.5 + 0.5;
    if (this.targets.auraSprite) {
      this.auraBlurFilter.strength = state.auraBlur + (auraPulse * 10);
      this.targets.auraSprite.scale.set(state.auraScale + (auraPulse * 0.02));
      this.targets.auraSprite.alpha = state.auraOpacity;
      
      // Standard RGB tinting colorizes the mask's native colors (set sliders to 255 to show original mask color)
      this.targets.auraSprite.tint = 
        (Math.floor(state.auraColorR) << 16) + 
        (Math.floor(state.auraColorG) << 8) + 
        Math.floor(state.auraColorB);
    }

    // 4. Cavern Lighting Reflector Updates
    const reflectionTint = 
      (Math.floor(state.auraColorR) << 16) + 
      (Math.floor(state.auraColorG) << 8) + 
      Math.floor(state.auraColorB);

    // Dynamic Cavern Light Alpha scaling influenced by the aura pulse, user intensity slider, and active screen-flicker
    const baseReflectAlpha = state.auraOpacity * (0.12 + auraPulse * 0.28) * (state.cavernLightIntensity ?? 1.0);
    const reflectionAlpha = Math.max(0, Math.min(1.0, baseReflectAlpha * flickerFactor));

    if (this.targets.mountainReflector) {
      this.targets.mountainReflector.tint = reflectionTint;
      this.targets.mountainReflector.alpha = reflectionAlpha;
    }

    if (this.targets.mountainBackReflector) {
      this.targets.mountainBackReflector.tint = reflectionTint;
      // Background mountains have slightly more subtle reflection due to atmospheric dust/fog layers
      this.targets.mountainBackReflector.alpha = reflectionAlpha * 0.65;
    }

    if (this.targets.ceilingReflector) {
      this.targets.ceilingReflector.tint = reflectionTint;
      this.targets.ceilingReflector.alpha = reflectionAlpha;
    }

    return metrics;
  }
}