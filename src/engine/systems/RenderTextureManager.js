// src/engine/systems/RenderTextureManager.js
import { Container, Sprite, RenderTexture, Assets } from 'pixi.js';
import { createWarpFilters } from '../filters/WarpFilterFactory.js';
import { MirroredScrollLayer } from './MirroredScrollLayer.js';

export class RenderTextureManager {
  constructor(options = {}) {
    this.time = 0;

    this.discoveredPatterns = options.discoveredPatterns || [];
    this.bgPat1Alias = options.bgPat1Alias || null;
    this.bgPat2Alias = options.bgPat2Alias || null;
    this.hasBgPat1 = options.hasBgPat1 ?? false;
    this.hasBgPat2 = options.hasBgPat2 ?? false;

    this.warpFilter = null;
    this.bgWarpFilter = null;

    this.localPatternContainer = null;
    this.localBgPatternContainer = null;

    this.bgPatternRenderTexture = null;
    this.patternRenderTexture = null;

    this.bgPatternSprite = null;
    this.patternSprite = null;

    this.bgPat1Layer = null;
    this.bgPat2Layer = null;

    this.buildManager();
  }

  buildManager() {
    const { warpFilter, bgWarpFilter } = createWarpFilters();
    this.warpFilter = warpFilter;
    this.bgWarpFilter = bgWarpFilter;

    // --- BACKGROUND PATTERNS ---
    const hasAnyBgPat = this.hasBgPat1 || this.hasBgPat2;
    if (hasAnyBgPat) {
      const sampleTex = Assets.get(this.bgPat1Alias || this.bgPat2Alias);
      const bgW = sampleTex ? sampleTex.width : 2000;
      const bgH = sampleTex ? sampleTex.height : 2000;

      this.localBgPatternContainer = new Container();
      this.localBgPatternContainer.filters = [this.bgWarpFilter];

      // Mirror-repeat wrap arrays applied to clean-rig background patterns
      if (this.hasBgPat2 && this.bgPat2Alias) {
        const tex2 = Assets.get(this.bgPat2Alias);
        this.bgPat2Layer = new MirroredScrollLayer(tex2, bgH, 1.8); 
        this.bgPat2Layer.position.set(bgW / 2, bgH / 2);
        this.localBgPatternContainer.addChild(this.bgPat2Layer);
      }
      if (this.hasBgPat1 && this.bgPat1Alias) {
        const tex1 = Assets.get(this.bgPat1Alias);
        this.bgPat1Layer = new MirroredScrollLayer(tex1, bgH, 1.0); 
        this.bgPat1Layer.position.set(bgW / 2, bgH / 2);
        this.localBgPatternContainer.addChild(this.bgPat1Layer);
      }

      this.bgPatternRenderTexture = RenderTexture.create({ width: bgW, height: bgH });
      this.bgPatternSprite = new Sprite(this.bgPatternRenderTexture);
    } else {
      this.bgPatternRenderTexture = RenderTexture.create({ width: 1, height: 1 });
      this.bgPatternSprite = new Sprite(this.bgPatternRenderTexture);
      this.bgPatternSprite.visible = false;
    }
    this.bgPatternSprite.anchor.set(0.5);

    // --- FOREGROUND CHARACTER PATTERNS ---
    if (this.discoveredPatterns.length > 0) {
      const sampleTex = Assets.get(this.discoveredPatterns[0]);
      const patW = sampleTex ? sampleTex.width : 2000;
      const patH = sampleTex ? sampleTex.height : 2000;

      this.localPatternContainer = new Container();
      this.localPatternContainer.filters = [this.warpFilter];

      for (const patternAlias of this.discoveredPatterns) {
        const sp = Sprite.from(patternAlias);
        sp.anchor.set(0.5);
        sp.position.set(patW / 2, patH / 2);
        this.localPatternContainer.addChild(sp);
      }

      this.patternRenderTexture = RenderTexture.create({ width: patW, height: patH });
      this.patternSprite = new Sprite(this.patternRenderTexture);
    } else {
      this.patternRenderTexture = RenderTexture.create({ width: 1, height: 1 });
      this.patternSprite = new Sprite(this.patternRenderTexture);
      this.patternSprite.visible = false;
    }
    this.patternSprite.anchor.set(0.5);
  }

  update(deltaTime, state, renderer) {
    const dtSeconds = deltaTime / 60;
    this.time += dtSeconds;

    if (this.localPatternContainer && this.localPatternContainer.children.length > 0) {
      const kids = this.localPatternContainer.children;
      if (kids.length === 1) {
        kids[0].scale.set(state.patternTopScale);
      } else if (kids.length > 1) {
        kids[0].scale.set(state.patternBottomScale);
        kids[kids.length - 1].scale.set(state.patternTopScale);
        for (let i = 1; i < kids.length - 1; i++) {
          kids[i].scale.set((state.patternBottomScale + state.patternTopScale) / 2);
        }
      }

      if (this.warpFilter && this.warpFilter.resources.warpUniforms) {
        this.warpFilter.resources.warpUniforms.uniforms.uTime = this.time * state.warpSpeed;
        this.warpFilter.resources.warpUniforms.uniforms.uWarpIntensity = state.warpIntensity;
      }

      renderer.render({
        container: this.localPatternContainer,
        target: this.patternRenderTexture
      });
    }

    if (this.localBgPatternContainer && this.localBgPatternContainer.children.length > 0) {
      const baseSpeed = state.bgScrollSpeed;

      if (this.bgPat2Layer) {
        this.bgPat2Layer.setPatternScale(state.bgPatternBottomScale);
        this.bgPat2Layer.updatePositions(dtSeconds, baseSpeed);
      }
      if (this.bgPat1Layer) {
        this.bgPat1Layer.setPatternScale(state.bgPatternTopScale);
        this.bgPat1Layer.updatePositions(dtSeconds, baseSpeed);
      }

      if (this.bgWarpFilter && this.bgWarpFilter.resources.warpUniforms) {
        this.bgWarpFilter.resources.warpUniforms.uniforms.uTime = this.time * state.bgWarpSpeed;
        this.bgWarpFilter.resources.warpUniforms.uniforms.uWarpIntensity = state.bgWarpIntensity;
      }

      renderer.render({
        container: this.localBgPatternContainer,
        target: this.bgPatternRenderTexture
      });
    }
  }

  destroy() {
    if (this.patternRenderTexture) {
      this.patternRenderTexture.destroy();
    }
    if (this.bgPatternRenderTexture) {
      this.bgPatternRenderTexture.destroy();
    }
    if (this.localPatternContainer) {
      this.localPatternContainer.destroy({ children: true });
    }
    if (this.localBgPatternContainer) {
      this.localBgPatternContainer.destroy({ children: true });
    }
    if (this.patternSprite) {
      this.patternSprite.destroy();
    }
    if (this.bgPatternSprite) {
      this.bgPatternSprite.destroy();
    }
  }
}