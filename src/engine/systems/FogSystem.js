// src/engine/systems/FogSystem.js
import { Sprite, Texture } from 'pixi.js';
import { EffectFactory } from '../filters/EffectFactory.js';

export class FogSystem {
  constructor(targetContainer, bgHeight, isForeground = false) {
    this.targetContainer = targetContainer;
    this.isForeground = isForeground;
    
    // Create a mesh-like sprite that covers the background area
    this.sprite = new Sprite(Texture.WHITE);
    this.sprite.anchor.set(0.5);
    this.sprite.width = bgHeight; 
    this.sprite.height = bgHeight;
    this.sprite.alpha = 1.0; 

    // Delegate compilation to the central factory
    this.filter = EffectFactory.createFogFilter();

    this.sprite.filters = [this.filter];
    this.targetContainer.addChild(this.sprite);
  }

  /**
   * Rescales the fog mesh width to cover ultra-wide screen borders.
   */
  resize(localW, localH) {
    if (this.sprite) {
      this.sprite.width = localW;
    }
  }

  update(time, config) {
    if (!this.filter) return;

    // Apply strict fallback baselines to safeguard the shader uniforms from NaN corruptions
    const fogOpacity = config.fogOpacity ?? 0.4;
    const fogSpeed = config.fogSpeed ?? 1.0;
    const fogColorR = config.fogColorR ?? 140;
    const fogColorG = config.fogColorG ?? 120;
    const fogColorB = config.fogColorB ?? 180;
    const fogSwaySpeed = config.fogSwaySpeed ?? 0.5;
    const fogSwayAmp = config.fogSwayAmp ?? 20.0;

    const unis = this.filter.resources.fogUniforms.uniforms;
    unis.uTime = time;
    
    const baseOpacity = this.isForeground ? fogOpacity * 0.55 : fogOpacity;
    unis.uOpacity = baseOpacity;
    
    const velocityScale = this.isForeground ? 1.45 : 0.85;
    unis.uSpeed = fogSpeed * 0.01 * velocityScale;
    
    unis.uColor = [
        fogColorR / 255,
        fogColorG / 255,
        fogColorB / 255
    ];

    const phaseOffset = this.isForeground ? 1.6 : 0.0;
    const sway = Math.sin((time * fogSwaySpeed) + phaseOffset) * fogSwayAmp;
    
    const verticalCenter = this.isForeground ? (this.sprite.height * 0.28) : (this.sprite.height * 0.12);
    this.sprite.y = verticalCenter + sway;
  }

  destroy() {
    if (this.sprite) {
      this.sprite.destroy(true);
    }
  }
}