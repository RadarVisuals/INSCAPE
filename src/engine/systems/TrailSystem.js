// src/engine/systems/TrailSystem.js
import { Container, Sprite } from 'pixi.js';

export class TrailSystem {
  /**
   * Initializes the trail container and prepares color-shifted ghost elements.
   * @param {Container} parentContainer - Parent display node.
   * @param {string|null} textureAlias - Cached visual sprite resource.
   */
  constructor(parentContainer, textureAlias) {
    this.parentContainer = parentContainer;
    this.textureAlias = textureAlias;
    
    this.trailContainer = new Container();
    this.parentContainer.addChild(this.trailContainer);

    this.trailSprites = [];
    this.trailHistory = [];

    if (this.textureAlias) {
      // Allocate three coordinate trailing elements
      for (let i = 0; i < 3; i++) {
        const s = Sprite.from(this.textureAlias);
        s.anchor.set(0.5);
        s.alpha = 0;
        s.visible = false;
        s.blendMode = 'screen'; // Screen blending gives bright, spectral energy

        // Assign visual shifts: Cyan, Magenta, and Flame Orange
        if (i === 0) s.tint = 0x00f3ff;
        else if (i === 1) s.tint = 0xff00ff;
        else s.tint = 0xff5500;

        this.trailContainer.addChild(s);
        this.trailSprites.push(s);
      }
    }
  }

  /**
   * Steers position mappings, scale expansions, and boundary alpha transitions.
   * @param {Object} headState - Target configuration offsets computed for the head.
   * @param {Object} config - Normalized application state variables.
   * @param {boolean} isGlitchActive - Flag denoting if a peak glitch state is occurring.
   */
  update(headState, config, isGlitchActive) {
    this.trailHistory.unshift({
      x: headState.x,
      y: headState.y,
      scaleX: headState.scale,
      scaleY: headState.scale,
      rotation: headState.rotation
    });

    const spacing = Math.max(2, config.trailSpacing ?? 5);
    const maxHistoryNeeded = spacing * 3 + 2;
    if (this.trailHistory.length > maxHistoryNeeded) {
      this.trailHistory.pop();
    }

    const trailCount = Math.max(0, Math.min(3, config.trailCount ?? 3));
    const manualAlpha = config.trailManualAlpha ?? 0.0;
    const glitchInfluence = config.trailGlitchInfluence ?? 0.6;

    // Scale trail visibility during visual shocks
    const shakeIntensity = config.glitchShakeIntensity ?? 0;
    const activeReactionProgress = config.reactionProgress ?? 0;
    const motionPulse = (shakeIntensity / 30) * (isGlitchActive ? 1.0 : 0.25);
    const dynamicAlpha = Math.max(motionPulse, activeReactionProgress) * glitchInfluence;

    const targetBaseAlpha = Math.max(manualAlpha, dynamicAlpha);

    this.trailSprites.forEach((sprite, index) => {
      if (index >= trailCount || targetBaseAlpha <= 0.01) {
        sprite.visible = false;
        sprite.alpha = 0;
        return;
      }

      const historyIndex = (index + 1) * spacing - 1;
      const historyState = this.trailHistory[historyIndex];

      if (historyState) {
        sprite.visible = true;
        
        // Spectral scale expansion: ensures older nodes peak out as outlines
        const scaleExpansion = 1.0 + (index + 1) * 0.04;
        
        // Vertical drift offset: simulates rising spectral smoke currents
        const driftOffsetY = (index + 1) * -8;

        sprite.position.set(historyState.x, historyState.y + driftOffsetY);
        sprite.scale.set(historyState.scaleX * scaleExpansion, historyState.scaleY * scaleExpansion);
        sprite.rotation = historyState.rotation;

        // Progressively fade coordinates of older trails
        const stepDecay = 1.0 - (index * 0.25);
        sprite.alpha = Math.max(0, Math.min(1.0, targetBaseAlpha * stepDecay));
      } else {
        sprite.visible = false;
        sprite.alpha = 0;
      }
    });
  }

  destroy() {
    if (this.trailContainer) {
      this.parentContainer.removeChild(this.trailContainer);
      this.trailContainer.destroy({ children: true });
      this.trailContainer = null;
    }
    this.trailSprites = [];
    this.trailHistory = [];
  }
}
