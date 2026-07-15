// src/engine/entities/StageEntity.js
import { Container, Sprite, Texture, Assets } from 'pixi.js';
import { MirroredScrollLayer } from '../systems/MirroredScrollLayer.js';
import { FogSystem } from '../systems/FogSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';

export class StageEntity {
  /**
   * @param {string} id - Unique identifier for the stage
   * @param {Object} keys - Resolved stage asset keys
   * @param {Object} flags - State flags determining layer rendering options
   * @param {number} bgHeightScale - Height boundary for scaling
   * @param {RenderTextureManager} renderTextureManager - Reference to the global texture pass
   * @param {Renderer} renderer - The PixiJS WebGL renderer
   */
  constructor(id, keys, flags, bgHeightScale, renderTextureManager, renderer) {
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

    this.layers = {};
    this.bgFog = null;
    this.fgFog = null;
    this.particleSystem = null;

    this.build();
  }

  build() {
    if (this.flags.isPanoramaMode) {
      const bgTexture = Assets.get('bg');
      if (bgTexture && bgTexture !== Texture.EMPTY) {
        this.layers.bg = new MirroredScrollLayer(bgTexture, this.bgHeightScale, 1.0);
        this.bgContainer.addChild(this.layers.bg);
      }

      if (this.flags.hasBg2) {
        const bg2Texture = Assets.get('bg2');
        if (bg2Texture && bg2Texture !== Texture.EMPTY) {
          this.layers.bg2 = new MirroredScrollLayer(bg2Texture, this.bgHeightScale, this.flags.bg2ParallaxSpeed);
          this.bgContainer.addChild(this.layers.bg2);
        }
      }
    } else {
      if (this.flags.hasBgClippingMask) {
        const bgClipTex = Assets.get(this.keys.bg_clipping_mask);
        if (bgClipTex && bgClipTex !== Texture.EMPTY) {
          this.layers.bg_clip = new MirroredScrollLayer(bgClipTex, this.bgHeightScale, 0.0);
          this.bgContainer.addChild(this.layers.bg_clip);
        }
      }

      const hasAnyBgPat = this.flags.hasBgPat1 || this.flags.hasBgPat2;
      if (hasAnyBgPat && this.renderTextureManager) {
        this.bgContainer.addChild(this.renderTextureManager.bgPatternSprite);

        this.layers.bg_pattern_reflect = new MirroredScrollLayer(
          this.renderTextureManager.bgPatternRenderTexture, 
          this.bgHeightScale, 
          0.0
        );
        this.layers.bg_pattern_reflect.blendMode = 'screen';
        this.bgContainer.addChild(this.layers.bg_pattern_reflect);
      }

      if (this.flags.hasBgMountainBack) {
        const mountainBackTex = Assets.get(this.keys.bg_mountain_back);
        if (mountainBackTex && mountainBackTex !== Texture.EMPTY) {
          this.layers.bg_mountain_back = new MirroredScrollLayer(mountainBackTex, this.bgHeightScale, 0.18);
          this.layers.bg_mountain_back.position.y = -35; 
          this.layers.bg_mountain_back.alpha = 0.75; 
          this.bgContainer.addChild(this.layers.bg_mountain_back);

          this.layers.bg_mountain_back_reflect = new MirroredScrollLayer(mountainBackTex, this.bgHeightScale, 0.18);
          this.layers.bg_mountain_back_reflect.position.y = -35;
          this.layers.bg_mountain_back_reflect.blendMode = 'screen';
          this.bgContainer.addChild(this.layers.bg_mountain_back_reflect);
        }
      }

      if (this.flags.hasBgMountain) {
        const mountainTex = Assets.get(this.keys.bg_mountain);
        if (mountainTex && mountainTex !== Texture.EMPTY) {
          this.layers.bg_mountain = new MirroredScrollLayer(mountainTex, this.bgHeightScale, 0.4);
          this.bgContainer.addChild(this.layers.bg_mountain);

          this.layers.bg_mountain_reflect = new MirroredScrollLayer(mountainTex, this.bgHeightScale, 0.4);
          this.layers.bg_mountain_reflect.blendMode = 'screen';
          this.bgContainer.addChild(this.layers.bg_mountain_reflect);
        }
      }
    }

    this.bgFog = new FogSystem(this.bgContainer, this.bgHeightScale, false);
    this.particleSystem = new ParticleSystem(this.renderer, this.bgContainer, this.bgHeightScale);
    this.fgFog = new FogSystem(this.fgContainer, this.bgHeightScale, true);
  }

  /**
   * Resizes all internal layers and atmospheric entities dynamically.
   */
  resize(localW, localH) {
    // Resize scrolling layers
    for (const key in this.layers) {
      if (this.layers[key] && typeof this.layers[key].resize === 'function') {
        this.layers[key].resize(localW, localH);
      }
    }

    // Resize fog meshes
    if (this.bgFog) this.bgFog.resize(localW, localH);
    if (this.fgFog) this.fgFog.resize(localW, localH);

    // Propagate down to the render texture pattern container if applicable
    if (this.renderTextureManager && typeof this.renderTextureManager.resize === 'function') {
      this.renderTextureManager.resize(localW, localH);
    }
  }

  update(deltaTime, sceneConfig, auraColor, runtime) {
    const dtSeconds = deltaTime / 60;
    const { background, atmosphere } = sceneConfig;
    const baseSpeed = background.scrollSpeed;
    const backParallax = background.parallaxSpeed;

    if (this.bgFog) {
      this.bgFog.update(runtime.elapsed, atmosphere.fog);
    }
    if (this.fgFog) {
      this.fgFog.update(runtime.elapsed, atmosphere.fog);
    }
    if (this.particleSystem) {
      this.particleSystem.update(deltaTime, atmosphere.particles, auraColor, runtime.reactionModifiers);
    }

    if (this.flags.isPanoramaMode) {
      if (this.layers.bg) {
        this.layers.bg.updatePositions(dtSeconds, baseSpeed, 1.0);
      }
      if (this.layers.bg2) {
        this.layers.bg2.updatePositions(dtSeconds, baseSpeed, backParallax);
      }
    } else {
      if (this.layers.bg_clip) {
        this.layers.bg_clip.updatePositions(dtSeconds, baseSpeed, 0.0);
      }
      if (this.renderTextureManager && this.renderTextureManager.bgPatternSprite) {
        this.renderTextureManager.bgPatternSprite.updatePositions(dtSeconds, baseSpeed, 0.0);
      }
      if (this.layers.bg_pattern_reflect) {
        this.layers.bg_pattern_reflect.updatePositions(dtSeconds, baseSpeed, 0.0);
      }

      if (this.layers.bg_mountain_back) {
        this.layers.bg_mountain_back.updatePositions(dtSeconds, baseSpeed, 0.15 * backParallax);
      }
      if (this.layers.bg_mountain_back_reflect) {
        this.layers.bg_mountain_back_reflect.updatePositions(dtSeconds, baseSpeed, 0.15 * backParallax);
      }
      if (this.layers.bg_mountain) {
        this.layers.bg_mountain.updatePositions(dtSeconds, baseSpeed, 0.40);
      }
      if (this.layers.bg_mountain_reflect) {
        this.layers.bg_mountain_reflect.updatePositions(dtSeconds, baseSpeed, 0.40);
      }
    }
  }

  getEffectsTargets() {
    return {
      mountainReflector: this.layers.bg_mountain_reflect || null,
      mountainBackReflector: this.layers.bg_mountain_back_reflect || null,
      ceilingReflector: this.layers.bg_pattern_reflect || null
    };
  }

  destroy() {
    if (this.particleSystem?.destroy) {
      this.particleSystem.destroy();
    }
    if (this.bgFog?.destroy) {
      this.bgFog.destroy();
    }
    if (this.fgFog?.destroy) {
      this.fgFog.destroy();
    }
    const sharedBgPatternSprite = this.renderTextureManager?.bgPatternSprite;
    if (sharedBgPatternSprite?.parent === this.bgContainer) {
      this.bgContainer.removeChild(sharedBgPatternSprite);
    }
    this.bgContainer.destroy({ children: true });
    this.fgContainer.destroy({ children: true });
  }
}
