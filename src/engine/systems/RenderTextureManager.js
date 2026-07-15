// src/engine/systems/RenderTextureManager.js
import { Container, Sprite, RenderTexture, Assets } from 'pixi.js';
import { createWarpFilters } from '../filters/WarpFilterFactory.js';
import { createOrganicWarpFilter } from '../filters/OrganicWarpFilterFactory.js';
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
    this.organicWarpFilters = [];
    this.activePatternWarpMode = 'classic';

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
      this.bgPatternSprite = new MirroredScrollLayer(this.bgPatternRenderTexture, bgH, 0.0);
    } else {
      this.bgPatternRenderTexture = RenderTexture.create({ width: 1, height: 1 });
      this.bgPatternSprite = new MirroredScrollLayer(this.bgPatternRenderTexture, 1, 0.0);
      this.bgPatternSprite.visible = false;
    }

    // --- FOREGROUND CHARACTER PATTERNS ---
    if (this.discoveredPatterns.length > 0) {
      const sampleTex = Assets.get(this.discoveredPatterns[0]);
      const patW = sampleTex ? sampleTex.width : 2000;
      const patH = sampleTex ? sampleTex.height : 2000;

      this.localPatternContainer = new Container();
      this.localPatternContainer.filters = [this.warpFilter];

      for (let index = 0; index < this.discoveredPatterns.length; index += 1) {
        const patternAlias = this.discoveredPatterns[index];
        const sp = Sprite.from(patternAlias);
        sp.anchor.set(0.5);
        sp.position.set(patW / 2, patH / 2);
        this.localPatternContainer.addChild(sp);
        this.organicWarpFilters.push(createOrganicWarpFilter(index));
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

  /**
   * Swaps the active character's textures dynamically.
   * This avoids destroying the background render textures so fogs and mountain
   * layers remain unaffected during updates.
   */
  updateActorPatterns(discoveredPatterns) {
    this.discoveredPatterns = discoveredPatterns || [];

    this.destroyOrganicWarpFilters();
    this.activePatternWarpMode = 'classic';

    if (this.localPatternContainer) {
      for (const child of this.localPatternContainer.children) {
        child.filters = null;
      }
      this.localPatternContainer.destroy({ children: true });
      this.localPatternContainer = null;
    }
    if (this.patternRenderTexture) {
      this.patternRenderTexture.destroy(true); // Reclaims the underlying GPU TextureSource during swaps
      this.patternRenderTexture = null;
    }

    if (this.discoveredPatterns.length > 0) {
      const sampleTex = Assets.get(this.discoveredPatterns[0]);
      const patW = sampleTex ? sampleTex.width : 2000;
      const patH = sampleTex ? sampleTex.height : 2000;

      this.localPatternContainer = new Container();
      this.localPatternContainer.filters = [this.warpFilter];

      for (let index = 0; index < this.discoveredPatterns.length; index += 1) {
        const patternAlias = this.discoveredPatterns[index];
        const sp = Sprite.from(patternAlias);
        sp.anchor.set(0.5);
        sp.position.set(patW / 2, patH / 2);
        this.localPatternContainer.addChild(sp);
        this.organicWarpFilters.push(createOrganicWarpFilter(index));
      }

      this.patternRenderTexture = RenderTexture.create({ width: patW, height: patH });
      
      if (this.patternSprite) {
        this.patternSprite.texture = this.patternRenderTexture;
        this.patternSprite.visible = true;
      } else {
        this.patternSprite = new Sprite(this.patternRenderTexture);
        this.patternSprite.anchor.set(0.5);
      }
    } else {
      this.patternRenderTexture = RenderTexture.create({ width: 1, height: 1 });
      if (this.patternSprite) {
        this.patternSprite.texture = this.patternRenderTexture;
        this.patternSprite.visible = false;
      }
    }
  }

  resize(localW, localH) {
    if (this.bgPatternSprite && typeof this.bgPatternSprite.resize === 'function') {
      this.bgPatternSprite.resize(localW, localH);
    }
  }

  setPatternWarpMode(mode) {
    if (!this.localPatternContainer || mode === this.activePatternWarpMode) return;

    const organicEnabled = mode === 'organic';
    this.localPatternContainer.filters = organicEnabled ? null : [this.warpFilter];
    for (let index = 0; index < this.localPatternContainer.children.length; index += 1) {
      const child = this.localPatternContainer.children[index];
      const organicFilter = this.organicWarpFilters[index];
      child.filters = organicEnabled && organicFilter ? [organicFilter] : null;
    }
    this.activePatternWarpMode = organicEnabled ? 'organic' : 'classic';
  }

  destroyOrganicWarpFilters() {
    for (const filter of this.organicWarpFilters) {
      filter?.destroy();
    }
    this.organicWarpFilters = [];
  }

  update(deltaTime, state, renderer, pointer = null, reactionState = { active: null, progress: 0 }) {
    const dtSeconds = deltaTime / 60;
    this.time += dtSeconds;

    if (this.localPatternContainer && this.localPatternContainer.children.length > 0) {
      const requestedWarpMode = state.warpMode === 'organic' ? 'organic' : 'classic';
      this.setPatternWarpMode(requestedWarpMode);

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

      let warpIntensityMultiplier = 0.0;
      const reaction = reactionState.active;
      const progress = reactionState.progress;

      if (reaction === "lyx_received") {
        warpIntensityMultiplier = (50.0 / Math.max(0.1, state.warpIntensity) - 1.0) * progress;
      } else if (reaction === "lsp7_received" || reaction === "lsp8_received") {
        warpIntensityMultiplier = (90.0 / Math.max(0.1, state.warpIntensity) - 1.0) * progress;
      }

      const currentWarpIntensity = state.warpIntensity * (1.0 + warpIntensityMultiplier);

      if (this.warpFilter && this.warpFilter.resources.warpUniforms) {
        this.warpFilter.resources.warpUniforms.uniforms.uTime = this.time * state.warpSpeed;
        this.warpFilter.resources.warpUniforms.uniforms.uWarpIntensity = currentWarpIntensity;
      }

      if (requestedWarpMode === 'organic') {
        const cursorPosition = pointer?.position || [0.5, 0.5];
        const cursorVelocity = pointer?.velocity || [0.0, 0.0];
        const cursorActive = pointer?.active ?? 0.0;
        for (const organicFilter of this.organicWarpFilters) {
          const uniforms = organicFilter?.resources.organicWarpUniforms?.uniforms;
          if (!uniforms) continue;
          uniforms.uTime = this.time * (state.warpSpeed ?? 1);
          uniforms.uWarpIntensity = currentWarpIntensity;
          uniforms.uMorphRange = state.warpOrganicRange ?? 1.0;
          uniforms.uLayerDivergence = state.warpLayerDivergence ?? 0.3;
          uniforms.uCursorPosition = cursorPosition;
          uniforms.uCursorVelocity = cursorVelocity;
          uniforms.uCursorActive = cursorActive;
          uniforms.uCursorInfluence = state.warpCursorInfluence ?? 0.45;
          uniforms.uCursorRadius = state.warpCursorRadius ?? 0.22;
        }
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
    if (this.localPatternContainer) {
      for (const child of this.localPatternContainer.children) {
        child.filters = null;
      }
    }
    this.destroyOrganicWarpFilters();
    if (this.patternRenderTexture) {
      this.patternRenderTexture.destroy(true); // Force-disposes of the GPU TextureSource
    }
    if (this.bgPatternRenderTexture) {
      this.bgPatternRenderTexture.destroy(true); // Reclaims the WebGL framebuffer allocation
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
