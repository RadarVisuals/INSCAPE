// src/engine/systems/TrailSystem.js
import { Container, Sprite } from 'pixi.js';
import { getTrailPresentation, recordTrailTransform } from './trailRuntime.js';

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
   * @param {Object} renderTransform - Actor transform as rendered under the trail parent.
   * @param {Object} config - Persistent spectral trail configuration.
   * @param {Object} runtime - Calculated glitch and reaction state.
   */
  update(renderTransform, config, runtime) {
    recordTrailTransform(this.trailHistory, renderTransform, config.spacing);

    this.trailSprites.forEach((sprite, index) => {
      const presentation = getTrailPresentation(this.trailHistory, index, config, runtime);
      if (!presentation) {
        sprite.visible = false;
        sprite.alpha = 0;
        return;
      }

      sprite.visible = true;
      sprite.position.set(presentation.x, presentation.y);
      sprite.scale.set(presentation.scaleX, presentation.scaleY);
      sprite.rotation = presentation.rotation;
      sprite.alpha = presentation.alpha;
    });
  }

  reset() {
    this.trailHistory = [];
    for (const sprite of this.trailSprites) {
      sprite.visible = false;
      sprite.alpha = 0;
    }
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
