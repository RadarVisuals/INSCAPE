// src/engine/systems/ParticleSystem.js
import { Container, Sprite, Graphics, Assets, Texture } from 'pixi.js';

export class ParticleSystem {
  constructor(renderer, targetContainer, bgSize) {
    this.renderer = renderer;
    this.targetContainer = targetContainer;
    this.bgSize = bgSize; // Sourced from square background height scale (e.g. 1000px)

    // Dedicated particles container added to the visual stage hierarchy
    this.particleContainer = new Container();
    this.targetContainer.addChild(this.particleContainer);

    // 1. Generate Texture A: Jagged 4-pointed ash shard
    const gAsh = new Graphics().star(0, 0, 4, 8, 3).fill({ color: 0xffffff });
    this.ashTexture = this.renderer.generateTexture(gAsh);
    gAsh.destroy();

    // 2. Generate Texture B: Wispy, soft atmospheric soot/tomb dust mote
    const gWispy = new Graphics().circle(0, 0, 24).fill({ color: 0xffffff, alpha: 0.3 });
    this.wispyTexture = this.renderer.generateTexture(gWispy);
    gWispy.destroy();

    this.particles = [];
  }

  /**
   * Main updates frame logic including particle properties, fluttering, drifting, and color blending.
   * @param {number} deltaTime - Current update tick step size.
   * @param {Object} state - State from useStore.
   */
  update(deltaTime, state) {
    const dtSeconds = deltaTime / 60;
    const halfSize = this.bgSize / 2;

    // Retrieve active visual variables from the store (falls back to a default bone-white if missing)
    const rTint = state.auraColorR ?? 235;
    const gTint = state.auraColorG ?? 200;
    const bTint = state.auraColorB ?? 150;

    // Pool expansion: Spawn particles to meet targeted configuration count
    while (this.particles.length < state.particleCount) {
      // Distribute types: 75% small jagged ash flakes, 25% large wispy soot motes
      const isMote = Math.random() < 0.25;
      const texture = isMote ? this.wispyTexture : this.ashTexture;
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.blendMode = 'normal'; // Standard blending for dusty, opaque air current occlusion

      // Type-specific baseline aesthetics
      let size, targetOpacity, type, speedY, speedX, swayFreq, swayWidth;
      let grayscale; // Base monotone value used to blend from soot black to bone white

      if (isMote) {
        // Large, suffocating wispy soot/tomb dust motes
        type = 'mote';
        size = Math.random() * 1.5 + 1.2; // Large, drifting scales
        targetOpacity = Math.random() * 0.15 + 0.10; // Soft but visible opacity range (10% to 25%)
        speedY = -(Math.random() * 1.5 + 0.5); // Crawl upward extremely slowly
        speedX = Math.random() * 2.0 - 1.0; 
        swayFreq = Math.random() * 0.5 + 0.1; // Slow, lazy sway
        swayWidth = Math.random() * 15 + 10;
        // Grayscale set to dark charcoal gray so it is visible against the background
        grayscale = Math.random() * 0.20 + 0.25; // 25% to 45% gray
      } else {
        // Small, fluttering jagged ash shards
        type = 'ash';
        size = Math.random() * 0.8 + 0.3; // Small granular ash shards
        targetOpacity = Math.random() * 0.30 + 0.25; // Good visibility range (25% to 55%)
        speedY = -(Math.random() * 10 + 4); // Gravity-defying upward drift speed
        speedX = Math.random() * 8 - 4;
        swayFreq = Math.random() * 2.5 + 1.0; // High-frequency fluttering representing asymmetric flakes
        swayWidth = Math.random() * 8 + 4; // Tight, chaotic movements
        
        // Distribution of soot gray, ash gray, and pale bone-white grayscale properties
        const paletteRoll = Math.random();
        if (paletteRoll < 0.35) {
          grayscale = Math.random() * 0.15 + 0.25; // Soot Gray (25% to 40% - visible on dark BG)
        } else if (paletteRoll < 0.75) {
          grayscale = Math.random() * 0.30 + 0.40; // Ash Gray (40% to 70%)
        } else {
          grayscale = Math.random() * 0.20 + 0.75; // Pale Bone-White (75% to 95%)
        }
      }

      sprite._custom = {
        type: type,
        x: (Math.random() - 0.5) * this.bgSize, // Spawn strictly within master artwork layout frame
        y: halfSize + Math.random() * 200,     // Spawn just beneath cropped canvas viewport limits
        size: size,
        speedY: speedY,
        speedX: speedX,
        targetOpacity: targetOpacity,
        swayFreq: swayFreq,
        swayWidth: swayWidth,
        birthTime: Math.random() * 100,
        grayscale: grayscale
      };

      sprite.scale.set(size * state.particleSize);
      sprite.alpha = 0; // Starts completely faded out, soft boundary fading handles transition

      this.particles.push(sprite);
      this.particleContainer.addChild(sprite);
    }

    // Pool contraction: Safely prune extra sprites
    while (this.particles.length > state.particleCount) {
      const p = this.particles.pop();
      this.particleContainer.removeChild(p);
      p.destroy();
    }

    // Physics propagation, color blending, and boundary calculations
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const c = p._custom;
      c.birthTime += dtSeconds;

      // Depth Parallax: Larger foreground objects float and drift faster than background ones
      const parallaxFactor = c.size;
      c.y += c.speedY * state.particleSpeed * parallaxFactor * deltaTime;

      // Motion dynamics: Erratic fluttering for flat ash flakes, slow crawlings for soot motes
      let sway;
      if (c.type === 'ash') {
        // Asymmetric fluttering math
        sway = Math.sin(c.birthTime * c.swayFreq * 2.8) * c.swayWidth * 1.5 * state.particleSway;
      } else {
        // Slow crawling
        sway = Math.sin(c.birthTime * c.swayFreq) * c.swayWidth * state.particleSway;
      }

      const drift = (c.speedX * state.particleSpeed * parallaxFactor * deltaTime) + (state.particleWind * deltaTime) + sway;
      c.x += drift;

      // Eerie Unified Tinting: Blends the default monotone grayscale with the active state color
      const finalR = Math.floor(rTint * c.grayscale);
      const finalG = Math.floor(gTint * c.grayscale);
      const finalB = Math.floor(bTint * c.grayscale);
      p.tint = (finalR << 16) + (finalG << 8) + finalB;

      // Soft Boundary Fading relative to background boundaries (150px fade zones)
      let fadeAlpha = c.targetOpacity;

      // Vertical bottom edge fading (spawn boundary)
      const bottomFadeLimit = halfSize - 150;
      if (c.y > bottomFadeLimit) {
        const bottomFactor = Math.max(0, Math.min(1, (halfSize - c.y) / 150));
        fadeAlpha *= bottomFactor;
      }
      // Vertical top edge fading (exit boundary)
      const topFadeLimit = -halfSize + 150;
      if (c.y < topFadeLimit) {
        const topFactor = Math.max(0, Math.min(1, (c.y - (-halfSize)) / 150));
        fadeAlpha *= topFactor;
      }
      // Horizontal edge fading
      const absX = Math.abs(c.x);
      const sideFadeLimit = halfSize - 150;
      if (absX > sideFadeLimit) {
        const edgeFactor = Math.max(0, Math.min(1, (halfSize - absX) / 150));
        fadeAlpha *= edgeFactor;
      }

      // Apply modifiers from user panel sliders
      p.alpha = Math.max(0, Math.min(1, fadeAlpha * state.particleOpacity));
      p.scale.set(c.size * state.particleSize);
      p.position.set(c.x, c.y);

      // Reset particle when reaching the boundaries of the scene bounds
      if (c.y < -halfSize - 50 || c.x < -halfSize - 50 || c.x > halfSize + 50) {
        c.y = halfSize + Math.random() * 200;
        c.x = (Math.random() - 0.5) * this.bgSize;
        c.birthTime = Math.random() * 100; // Reset offset to keep patterns diverse
      }
    }
  }

  /**
   * Clears active sprite lists, references and generated textures on component destruction.
   */
  destroy() {
    if (this.particles) {
      for (const p of this.particles) {
        p.destroy();
      }
      this.particles = [];
    }
    if (this.ashTexture) {
      this.ashTexture.destroy(true);
    }
    if (this.wispyTexture) {
      this.wispyTexture.destroy(true);
    }
    if (this.particleContainer) {
      this.particleContainer.destroy({ children: true });
    }
  }
}