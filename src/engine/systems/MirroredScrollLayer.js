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
    // Instantiate 4 sprites to cover ultra-wide viewports comfortably
    for (let i = -1; i <= 2; i++) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.y = 0;
      this.addChild(sprite);
      this.items.push({ sprite, baseIndex: i });
    }
    
    this.updatePositions(0);
  }

  setPatternScale(scaleFactor) {
    this.customScaleFactor = scaleFactor;
  }

  updatePositions(dtSeconds, baseSpeed = 0, dynamicSpeedFactor) {
    // Falls back to constructor's speed factor if no dynamic factor is supplied on tick
    const activeSpeedFactor = dynamicSpeedFactor !== undefined ? dynamicSpeedFactor : this.speedFactor;
    this.scrollX -= baseSpeed * activeSpeedFactor * dtSeconds;

    const scaleFactorToUse = this.customScaleFactor !== undefined ? this.customScaleFactor : 1.0;
    const finalScale = this.spriteScale * scaleFactorToUse;
    const w = this.textureWidth * finalScale; // Recalculate scaled width dynamically to account for runtime pattern scaling
    const halfTotal = w * 2;

    this.items.forEach(item => {
      let localX = (item.baseIndex * w) + this.scrollX;

      // Wrap local X coordinates seamlessly
      while (localX < -halfTotal) {
        localX += w * 4;
      }
      while (localX > halfTotal) {
        localX -= w * 4;
      }

      item.sprite.position.set(localX, 0);

      // Determine absolute grid index to apply correct mirroring flips
      const gridIndex = Math.round((localX - this.scrollX) / w);
      const isEven = Math.abs(gridIndex) % 2 === 0;
      item.sprite.scale.set(finalScale * (isEven ? 1 : -1), finalScale);
    });
  }
}