// src/engine/systems/EffectsSystem.js
import { EffectFactory } from '../filters/EffectFactory.js';

export class EffectsSystem {
  constructor() {
    // 1. Instantiate filter instances via the central factory
    this.rgbSplitFilter = EffectFactory.createChromaticAberration();
    this.auraBlurFilter = EffectFactory.createAuraBlur(20);
    this.colorMatrix = EffectFactory.createColorMatrix();

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
   */
  attach(targets) {
    this.targets = { ...this.targets, ...targets };

    if (this.targets.headContainer) {
      this.targets.headContainer.filters = [this.rgbSplitFilter];
    }
    if (this.targets.auraSprite) {
      const hasMutationFilter = (this.targets.auraSprite.filters || []).length > 0;
      this.auraBlurFilter.padding = hasMutationFilter ? 0 : 100;
      this.targets.auraSprite.filters = [
        ...(this.targets.auraSprite.filters || []),
        this.auraBlurFilter
      ];
    }
    if (this.targets.baseSprite) {
      this.targets.baseSprite.filters = [
        ...(this.targets.baseSprite.filters || []),
        this.colorMatrix
      ];
    }
  }

  /**
   * Updates visual parameters on a per-frame basis.
   * @param {number} time - Elapsed time in seconds.
   * @param {Object} state - State from useStore.
   * @returns {Object} Glitch state metrics for the main engine.
   */
  update(time, state) {
    const metrics = {
      isGlitched: false,
      currentSplit: state.aberrationAmount
    };

    // Calculate transition multipliers/modifiers cleanly on top of baseline slider values
    let aberrationAmountModifier = 0.0;
    let aberrationSpeedOverride = state.aberrationSpeed;
    let auraOpacityMultiplier = 0.0;
    let auraScaleMultiplier = 0.0;
    let flickerIntensityModifier = 0.0;

    const reaction = state.activeReaction;
    const progress = state.reactionProgress ?? 0.0;

    if (reaction === "lyx_received") {
      auraOpacityMultiplier = (1.0 / Math.max(0.01, state.auraOpacity) - 1.0) * progress;
      auraScaleMultiplier = (1.35 / Math.max(0.1, state.auraScale) - 1.0) * progress;
    } else if (reaction === "lsp7_received" || reaction === "lsp8_received") {
      aberrationAmountModifier = (30.0 - state.aberrationAmount) * progress;
      flickerIntensityModifier = (0.85 - state.flickerIntensity) * progress;
      aberrationSpeedOverride = 8.0;
    }

    const currentAberrationAmount = state.aberrationAmount + aberrationAmountModifier;
    const currentAuraOpacity = state.auraOpacity * (1.0 + auraOpacityMultiplier);
    const currentAuraScale = state.auraScale * (1.0 + auraScaleMultiplier);
    const currentFlickerIntensity = state.flickerIntensity + flickerIntensityModifier;

    // 1. RGB Split / Glitch Calculations
    if (aberrationSpeedOverride > 0) {
      const pulseWave = Math.sin(time * aberrationSpeedOverride * 3);
      metrics.currentSplit = Math.abs(pulseWave) * currentAberrationAmount;

      const activeGlitchChance = (reaction === "lsp7_received" || reaction === "lsp8_received") 
        ? 0.0 
        : state.aberrationGlitch;

      if (activeGlitchChance > 0 && Math.random() < (0.008 * activeGlitchChance)) {
        metrics.currentSplit = currentAberrationAmount * (1.5 + Math.random() * 1.5);
        metrics.isGlitched = true;
      }
    }
    this.rgbSplitFilter.red = { x: metrics.currentSplit, y: 0 };
    this.rgbSplitFilter.blue = { x: -metrics.currentSplit, y: 0 };

    // 2. Color Matrix / Strobe Calculations
    let flickerFactor = 1.0;
    if (this.targets.baseSprite) {
      if (currentFlickerIntensity > 0) {
        const strobeTime = time * state.flickerSpeed * 45;
        const waveValue = Math.sin(strobeTime) * Math.sin(strobeTime * 2.3) * Math.cos(strobeTime * 0.85);
        const triggerThreshold = 1.0 - currentFlickerIntensity;
        this.colorMatrix.reset();

        if (waveValue > triggerThreshold) {
          this.colorMatrix.brightness(1.8, false);
          this.colorMatrix.contrast(1.5, true);
          flickerFactor = 1.8;
        } else if (waveValue < -triggerThreshold) {
          this.colorMatrix.brightness(0.05, false);
          flickerFactor = 0.05;
        } else {
          const randoB = 1.0 + (Math.random() - 0.5) * 0.15 * currentFlickerIntensity;
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
      this.targets.auraSprite.scale.set(currentAuraScale + (auraPulse * 0.02));
      this.targets.auraSprite.alpha = currentAuraOpacity;
      
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

    const baseReflectAlpha = currentAuraOpacity * (0.12 + auraPulse * 0.28) * (state.cavernLightIntensity ?? 1.0);
    const reflectionAlpha = Math.max(0, Math.min(1.0, baseReflectAlpha * flickerFactor));

    if (this.targets.mountainReflector) {
      this.targets.mountainReflector.tint = reflectionTint;
      this.targets.mountainReflector.alpha = reflectionAlpha;
    }

    if (this.targets.mountainBackReflector) {
      this.targets.mountainBackReflector.tint = reflectionTint;
      this.targets.mountainBackReflector.alpha = reflectionAlpha * 0.65;
    }

    if (this.targets.ceilingReflector) {
      this.targets.ceilingReflector.tint = reflectionTint;
      this.targets.ceilingReflector.alpha = reflectionAlpha;
    }

    return metrics;
  }
}
