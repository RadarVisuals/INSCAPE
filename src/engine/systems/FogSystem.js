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

  update(time, fogConfig) {
    if (!this.filter) return;

    const { opacity, speed, color, swaySpeed, swayAmplitude } = fogConfig;

    const unis = this.filter.resources.fogUniforms.uniforms;
    unis.uTime = time;
    
    const baseOpacity = this.isForeground ? opacity * 0.55 : opacity;
    unis.uOpacity = baseOpacity;
    
    const velocityScale = this.isForeground ? 1.45 : 0.85;
    unis.uSpeed = speed * 0.01 * velocityScale;
    
    unis.uColor = [
        color[0] / 255,
        color[1] / 255,
        color[2] / 255
    ];

    const phaseOffset = this.isForeground ? 1.6 : 0.0;
    const sway = Math.sin((time * swaySpeed) + phaseOffset) * swayAmplitude;
    
    const verticalCenter = this.isForeground ? (this.sprite.height * 0.28) : (this.sprite.height * 0.12);
    this.sprite.y = verticalCenter + sway;
  }

  destroy() {
    if (this.sprite) {
      this.sprite.filters = null;
      this.sprite.destroy({ texture: false, textureSource: false });
      this.sprite = null;
    }
    this.filter?.destroy?.();
    this.filter = null;
  }
}
