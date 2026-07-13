// src/engine/systems/MirroredScrollLayer.js
import { Container, Sprite } from 'pixi.js';

export class MirroredScrollLayer extends Container {
  constructor(texture, targetHeight, speedFactor) {
    super();
    this.texture = texture;
    this.textureWidth = texture.width;
    this.textureHeight = texture.height;

    // Scale to fit the target layout height
    this.spriteScale = targetHeight / this.textureHeight;
    this.speedFactor = speedFactor;
    this.scrollX = 0;
    this.customScaleFactor = 1.0;

    this.items = [];
    this.localW = 2000; // Default fallback width
    
    this.rebuildSprites();
  }

  setPatternScale(scaleFactor) {
    this.customScaleFactor = scaleFactor;
  }

  /**
   * Resizes the layer and adjusts the sprite pool count dynamically to prevent seams.
   */
  resize(localW, localH) {
    this.localW = localW;
    this.rebuildSprites();
  }

  /**
   * Calculates the exact number of sprites needed to tile the current screen width seamlessly.
   */
  rebuildSprites() {
    const scaleFactorToUse = this.customScaleFactor !== undefined ? this.customScaleFactor : 1.0;
    const finalScale = this.spriteScale * scaleFactorToUse;
    const w = this.textureWidth * finalScale;

    // Determine the pool size: visible viewport divided by sprite width, plus 2 padding sprites
    const needed = Math.max(4, Math.ceil(this.localW / w) + 2);

    if (this.items.length !== needed) {
      // Safely clear old child nodes to avoid leaks
      this.items.forEach(item => {
        if (item.sprite) {
          this.removeChild(item.sprite);
          item.sprite.destroy({ children: true, texture: false }); // Safely clean up sprite references while preserving shared source textures
        }
      });
      this.items = [];

      // Re-populate sprite pool centered horizontally
      const startIdx = -Math.floor(needed / 2);
      for (let i = 0; i < needed; i++) {
        const baseIndex = startIdx + i;
        const sprite = new Sprite(this.texture);
        sprite.anchor.set(0.5);
        sprite.y = 0;
        this.addChild(sprite);
        this.items.push({ sprite, baseIndex });
      }
    }
  }

  updatePositions(dtSeconds, baseSpeed = 0, dynamicSpeedFactor) {
    const activeSpeedFactor = dynamicSpeedFactor !== undefined ? dynamicSpeedFactor : this.speedFactor;
    this.scrollX -= baseSpeed * activeSpeedFactor * dtSeconds;

    const scaleFactorToUse = this.customScaleFactor !== undefined ? this.customScaleFactor : 1.0;
    const finalScale = this.spriteScale * scaleFactorToUse;
    const w = this.textureWidth * finalScale;

    const totalWidth = this.items.length * w;
    const halfTotalWidth = totalWidth / 2;

    this.items.forEach(item => {
      let localX = (item.baseIndex * w) + this.scrollX;

      // Wrap local coordinates based on the total width of the active sprite pool
      while (localX < -halfTotalWidth) {
        localX += totalWidth;
      }
      while (localX > halfTotalWidth) {
        localX -= totalWidth;
      }

      item.sprite.position.set(localX, 0);

      // Apply mirroring flips to ensure seamless transitions at texture boundaries
      const gridIndex = Math.round((localX - this.scrollX) / w);
      const isEven = Math.abs(gridIndex) % 2 === 0;
      item.sprite.scale.set(finalScale * (isEven ? 1 : -1), finalScale);
    });
  }
}