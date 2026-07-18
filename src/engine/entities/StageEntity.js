// src/engine/entities/StageEntity.js
import { Container } from 'pixi.js';
import { createEnvironmentRenderer } from './createEnvironmentRenderer.js';

export class StageEntity {
  /**
   * @param {string} id - Unique identifier for the stage
   * @param {Object} keys - Resolved stage asset keys
   * @param {Object} flags - State flags determining layer rendering options
   * @param {number} bgHeightScale - Height boundary for scaling
   * @param {RenderTextureManager} renderTextureManager - Reference to the global texture pass
   * @param {Renderer} renderer - The PixiJS WebGL renderer
   */
  constructor(id, keys, flags, bgHeightScale, renderTextureManager, renderer, sceneConfig) {
    this.id = id;
    this.keys = keys;
    this.flags = flags;
    this.bgHeightScale = bgHeightScale;
    this.renderTextureManager = renderTextureManager;
    this.renderer = renderer;

    this.bgContainer = new Container();
    this.bgContainer.label = `stage_bg_${id}`;

    this.fgContainer = new Container();
    this.fgContainer.label = `stage_fg_${id}`;

    this.destroyed = false;
    this.environment = createEnvironmentRenderer(sceneConfig, {
      bgContainer: this.bgContainer, fgContainer: this.fgContainer, keys, flags,
      bgHeightScale, renderTextureManager, renderer
    });
  }

  /**
   * Resizes all internal layers and atmospheric entities dynamically.
   */
  resize(localW, localH) {
    this.environment.resize(localW, localH);
  }

  update(deltaTime, sceneConfig, auraColor, runtime) {
    this.environment.update(deltaTime, sceneConfig, { ...runtime, auraColor });
  }

  getEffectsTargets() {
    return this.environment.getEffectsTargets();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.environment.destroy();
    this.environment = null;
    this.bgContainer.destroy({ children: true });
    this.fgContainer.destroy({ children: true });
  }
}
