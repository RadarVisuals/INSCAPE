import { Assets, Texture } from 'pixi.js';
import { MirroredScrollLayer } from '../systems/MirroredScrollLayer.js';
import { FogSystem } from '../systems/FogSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';

export class IllustratedStageEnvironment {
  constructor({ bgContainer, fgContainer, keys, flags, bgHeightScale, renderTextureManager, renderer }) {
    Object.assign(this, { bgContainer, fgContainer, keys, flags, bgHeightScale, renderTextureManager, renderer });
    this.layers = {};
    this.destroyed = false;
    this.build();
  }

  build() {
    if (this.flags.isPanoramaMode) {
      this.addLayer('bg', Assets.get('bg'), 1);
      if (this.flags.hasBg2) this.addLayer('bg2', Assets.get('bg2'), this.flags.bg2ParallaxSpeed);
    } else {
      if (this.flags.hasBgClippingMask) this.addLayer('bg_clip', Assets.get(this.keys.bg_clipping_mask), 0);
      if ((this.flags.hasBgPat1 || this.flags.hasBgPat2) && this.renderTextureManager) {
        this.bgContainer.addChild(this.renderTextureManager.bgPatternSprite);
        this.addLayer('bg_pattern_reflect', this.renderTextureManager.bgPatternRenderTexture, 0, { blendMode: 'screen' });
      }
      this.addMountain('bg_mountain_back', this.flags.hasBgMountainBack, this.keys.bg_mountain_back, 0.18, -35, 0.75);
      this.addMountain('bg_mountain', this.flags.hasBgMountain, this.keys.bg_mountain, 0.4);
    }
    this.bgFog = new FogSystem(this.bgContainer, this.bgHeightScale, false);
    this.particleSystem = new ParticleSystem(this.renderer, this.bgContainer, this.bgHeightScale);
    this.fgFog = new FogSystem(this.fgContainer, this.bgHeightScale, true);
  }

  addLayer(key, texture, parallax, properties = {}) {
    if (!texture || texture === Texture.EMPTY) return;
    const layer = new MirroredScrollLayer(texture, this.bgHeightScale, parallax);
    Object.assign(layer, properties);
    this.layers[key] = layer;
    this.bgContainer.addChild(layer);
  }

  addMountain(key, enabled, assetKey, parallax, y = 0, alpha = 1) {
    if (!enabled) return;
    const texture = Assets.get(assetKey);
    this.addLayer(key, texture, parallax, { y, alpha });
    this.addLayer(`${key}_reflect`, texture, parallax, { y, blendMode: 'screen' });
  }

  resize(width, height) {
    Object.values(this.layers).forEach((layer) => layer?.resize?.(width, height));
    this.bgFog?.resize(width, height);
    this.fgFog?.resize(width, height);
    this.renderTextureManager?.resize?.(width, height);
  }

  update(deltaTime, sceneConfig, runtime) {
    const dtSeconds = deltaTime / 60;
    const { background, atmosphere } = sceneConfig;
    const speed = background.scrollSpeed;
    const parallax = background.parallaxSpeed;
    this.bgFog?.update(runtime.elapsed, atmosphere.fog);
    this.fgFog?.update(runtime.elapsed, atmosphere.fog);
    this.particleSystem?.update(deltaTime, atmosphere.particles, runtime.auraColor, runtime.reactionModifiers);
    this.layers.bg?.updatePositions(dtSeconds, speed, 1);
    this.layers.bg2?.updatePositions(dtSeconds, speed, parallax);
    this.layers.bg_clip?.updatePositions(dtSeconds, speed, 0);
    this.renderTextureManager?.bgPatternSprite?.updatePositions(dtSeconds, speed, 0);
    this.layers.bg_pattern_reflect?.updatePositions(dtSeconds, speed, 0);
    this.layers.bg_mountain_back?.updatePositions(dtSeconds, speed, 0.15 * parallax);
    this.layers.bg_mountain_back_reflect?.updatePositions(dtSeconds, speed, 0.15 * parallax);
    this.layers.bg_mountain?.updatePositions(dtSeconds, speed, 0.4);
    this.layers.bg_mountain_reflect?.updatePositions(dtSeconds, speed, 0.4);
  }

  getEffectsTargets() {
    return { mountainReflector: this.layers.bg_mountain_reflect || null,
      mountainBackReflector: this.layers.bg_mountain_back_reflect || null,
      ceilingReflector: this.layers.bg_pattern_reflect || null };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.particleSystem?.destroy?.();
    this.bgFog?.destroy?.();
    this.fgFog?.destroy?.();
    const sharedPattern = this.renderTextureManager?.bgPatternSprite;
    if (sharedPattern?.parent === this.bgContainer) this.bgContainer.removeChild(sharedPattern);
    Object.values(this.layers).forEach((layer) => { if (!layer.destroyed) layer.destroy({ children: true }); });
    this.layers = {};
  }
}
