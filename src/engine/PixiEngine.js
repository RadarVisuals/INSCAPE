// src/engine/PixiEngine.js
import { 
  Application, 
  Assets, 
  Container, 
  Sprite,
  TilingSprite,
  Texture,
  Graphics
} from 'pixi.js';
import { useStore } from '../store/useStore.js';
import { EffectsSystem } from './systems/EffectsSystem.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { EyeSystem } from './systems/EyeSystem.js';
import { createWarpFilters } from './filters/WarpFilterFactory.js';

function testImageAsset(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

export class PixiEngine {
  constructor(containerElement) {
    this.container = containerElement;
    this.app = new Application();
    this.layers = {};
    this.time = 0;
    this.isReady = false;
    this.isDestroyed = false;

    // Direct existential flags
    this.hasBgClippingMask = false;
    this.hasBgMountain = false;
    this.hasCharClippingMask = false;
    this.hasLineart = false;

    this.discoveredPatterns = [];
    this.discoveredEyes = [];
    this.hasEyelids = false;
    this.hasBgPat1 = false;
    this.hasBgPat2 = false;

    this.isPanoramaMode = false;
    this.hasBg2 = false;
    this.keys = {}; 

    this.effectsSystem = new EffectsSystem();
    this.eyeSystem = null;
    this.particleSystem = null;

    // Setup filter instances
    this.warpFilter = null;
    this.bgWarpFilter = null;

    this.config = { ...useStore.getState() };

    this.unsubscribeStore = useStore.subscribe((state) => {
      const prevChar = this.config.characterId;
      const prevBgClip = this.config.bgClippingMaskId;
      const prevBgStyle = this.config.bgPatternStyle;
      const prevBgMountain = this.config.bgMountainId;

      this.config = state;

      if (
        prevChar !== state.characterId ||
        prevBgClip !== state.bgClippingMaskId ||
        prevBgStyle !== state.bgPatternStyle ||
        prevBgMountain !== state.bgMountainId
      ) {
        this.reloadAssetsAndScene().catch(err => console.error("Re-init assets failed:", err));
      }
    });
  }

  async init() {
    try {
      await this.app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundAlpha: 1,
        backgroundColor: 0x050505,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        preference: 'webgl', 
      });

      if (this.isDestroyed) {
        this.app.destroy(true);
        return;
      }

      this.container.appendChild(this.app.canvas);
      await this.loadAssets();

      if (this.isDestroyed) {
        this.app.destroy(true);
        return;
      }
      
      this.buildSceneGraph();
      this.app.ticker.add((ticker) => this.update(ticker.deltaTime));
      this.resize();
      
      this.isReady = true;
    } catch (err) {
      console.error("PixiEngine Init Error:", err);
    }
  }

  async loadAssets() {
    const { characterId, bgClippingMaskId, bgPatternStyle, bgMountainId } = this.config;
    const verifiedLoadQueue = [];

    this.discoveredPatterns = [];
    this.discoveredEyes = [];
    this.hasEyelids = false;
    this.isPanoramaMode = false;
    this.hasBg2 = false;

    console.log(`%c🔍 [PixiEngine] Rig Loader: Locating Stage Assets`, 'color: #00f3ff; font-weight: bold;');

    // Normalize IDs to padded 2-digit strings (e.g. 1 -> "01", 2 -> "02")
    const padId = (id) => typeof id === 'number' ? String(id).padStart(2, '0') : id;
    const formattedMountainId = padId(bgMountainId);

    this.keys = {
      bg_clipping_mask: `bg_clipping_mask_${bgClippingMaskId}`,
      bg_pat_1: `bg_pat_1_${bgPatternStyle}`,
      bg_pat_2: `bg_pat_2_${bgPatternStyle}`,
      bg_mountain: `bg_mountain_${formattedMountainId}`,
      char_clipping_mask: `char_clipping_mask_${characterId}`,
      char_lineart: `char_lineart_${characterId}`,
      eyelids_top: `eyelids_top_${characterId}`,
      eyelids_bottom: `eyelids_bottom_${characterId}`
    };

    // --- Legacy Panorama Detection ---
    let panorama1Path = '/assets/panorama1.webp';
    let hasPanorama1 = await testImageAsset(panorama1Path);
    if (!hasPanorama1) {
      panorama1Path = '/assets/stage/panorama1.webp';
      hasPanorama1 = await testImageAsset(panorama1Path);
    }

    if (hasPanorama1) {
      this.isPanoramaMode = true;
      console.log("🌌 [PixiEngine] Legacy Panorama detected. Building Tiling Layers.");
      verifiedLoadQueue.push({ alias: 'bg', src: panorama1Path });

      let panorama2Path = '/assets/panorama2.webp';
      let hasPanorama2 = await testImageAsset(panorama2Path);
      if (!hasPanorama2) {
        panorama2Path = '/assets/stage/panorama2.webp';
        hasPanorama2 = await testImageAsset(panorama2Path);
      }
      if (hasPanorama2) {
        this.hasBg2 = true;
        verifiedLoadQueue.push({ alias: 'bg2', src: panorama2Path });
      } else {
        Assets.cache.set('bg2', Texture.EMPTY);
      }
    } else {
      Assets.cache.set('bg', Texture.EMPTY);
      Assets.cache.set('bg2', Texture.EMPTY);
    }

    // --- Dynamic Background Layers (Clean Rig) ---
    if (!this.isPanoramaMode) {
      // 1. Backdrop Color
      const bgClipPath = `/assets/stage/backdrops/backdrop_${bgClippingMaskId}.webp`;
      this.hasBgClippingMask = await testImageAsset(bgClipPath);
      if (this.hasBgClippingMask) {
        console.log(`✅ [PixiEngine] Backdrop: ${bgClipPath}`);
        verifiedLoadQueue.push({ alias: this.keys.bg_clipping_mask, src: bgClipPath });
      } else {
        console.warn(`⚠️ [PixiEngine] Missing Backdrop Color at: ${bgClipPath}`);
        Assets.cache.set(this.keys.bg_clipping_mask, Texture.EMPTY);
      }

      // 2. Background Flat Patterns (style_bottom and style_top)
      const bgPat1Path = `/assets/stage/patterns/${bgPatternStyle}_top.webp`;
      const bgPat2Path = `/assets/stage/patterns/${bgPatternStyle}_bottom.webp`;
      this.hasBgPat1 = await testImageAsset(bgPat1Path);
      this.hasBgPat2 = await testImageAsset(bgPat2Path);

      if (this.hasBgPat1) {
        console.log(`✅ [PixiEngine] Found BG Pattern Top: ${bgPat1Path}`);
        verifiedLoadQueue.push({ alias: this.keys.bg_pat_1, src: bgPat1Path });
      } else {
        console.warn(`⚠️ [PixiEngine] Missing BG Pattern Top at: ${bgPat1Path}`);
      }

      if (this.hasBgPat2) {
        console.log(`✅ [PixiEngine] Found BG Pattern Bottom: ${bgPat2Path}`);
        verifiedLoadQueue.push({ alias: this.keys.bg_pat_2, src: bgPat2Path });
      } else {
        console.warn(`⚠️ [PixiEngine] Missing BG Pattern Bottom at: ${bgPat2Path}`);
      }

      // 3. Mountains Layer
      let mountainPath = `/assets/stage/mountains/mountain_${formattedMountainId}.webp`;
      this.hasBgMountain = await testImageAsset(mountainPath);
      if (!this.hasBgMountain) {
        // Fallback to unpadded ID
        mountainPath = `/assets/stage/mountains/mountain_${bgMountainId}.webp`;
        this.hasBgMountain = await testImageAsset(mountainPath);
      }
      if (this.hasBgMountain) {
        console.log(`✅ [PixiEngine] Mountain Graphic: ${mountainPath}`);
        verifiedLoadQueue.push({ alias: this.keys.bg_mountain, src: mountainPath });
      } else {
        console.warn(`⚠️ [PixiEngine] Missing Mountain Asset at: /assets/stage/mountains/mountain_${formattedMountainId}.webp`);
        Assets.cache.set(this.keys.bg_mountain, Texture.EMPTY);
      }
    }

    // --- Foreground Character Clipping Mask ---
    const charClipPath = `/assets/actors/${characterId}/mask.webp`;
    this.hasCharClippingMask = await testImageAsset(charClipPath);
    if (this.hasCharClippingMask) {
      console.log(`✅ [PixiEngine] Actor Mask: ${charClipPath}`);
      verifiedLoadQueue.push({ alias: this.keys.char_clipping_mask, src: charClipPath });
    } else {
      console.error(`❌ [PixiEngine] Missing Actor Mask at: ${charClipPath}. Silhouette clipping and patterns bypassed.`);
      Assets.cache.set(this.keys.char_clipping_mask, Texture.EMPTY);
    }

    // --- Foreground Character Patterns (Dynamic sequential scan: pattern_01, pattern_02...) ---
    let patternIndex = 1;
    while (true) {
      const idxStr = padId(patternIndex);
      let patPath = `/assets/actors/${characterId}/patterns/pattern_${idxStr}.webp`;
      let exists = await testImageAsset(patPath);

      if (!exists) {
        // Fallback checks for unpadded index formatting
        patPath = `/assets/actors/${characterId}/patterns/pattern_${patternIndex}.webp`;
        exists = await testImageAsset(patPath);
      }
      if (!exists) break;

      console.log(`✅ [PixiEngine] Found Pattern Layer #${patternIndex}: ${patPath}`);
      const alias = `char_${characterId}_pattern_${patternIndex}`;
      verifiedLoadQueue.push({ alias, src: patPath });
      this.discoveredPatterns.push(alias);
      patternIndex++;
      if (patternIndex > 30) break;
    }

    // --- Foreground Character Lineart ---
    const lineartPath = `/assets/actors/${characterId}/lineart.webp`;
    this.hasLineart = await testImageAsset(lineartPath);
    if (this.hasLineart) {
      console.log(`✅ [PixiEngine] Lineart Layout: ${lineartPath}`);
      verifiedLoadQueue.push({ alias: this.keys.char_lineart, src: lineartPath });
    } else {
      console.error(`❌ [PixiEngine] Missing Lineart File at: ${lineartPath}`);
      Assets.cache.set(this.keys.char_lineart, Texture.EMPTY);
    }

    // --- Foreground Character Dynamic Eye Sockets (Sequential scan: socket_01, socket_02...) ---
    let socketIndex = 1;
    while (true) {
      const idxStr = padId(socketIndex);
      let eyeballPath = `/assets/actors/${characterId}/eyes/socket_${idxStr}/eyeball.webp`;
      let pupilPath = `/assets/actors/${characterId}/eyes/socket_${idxStr}/pupil.webp`;

      let hasEyeball = await testImageAsset(eyeballPath);
      let hasPupil = await testImageAsset(pupilPath);

      if (!hasEyeball && !hasPupil) {
        // Fallback checks for unpadded indices
        eyeballPath = `/assets/actors/${characterId}/eyes/socket_${socketIndex}/eyeball.webp`;
        pupilPath = `/assets/actors/${characterId}/eyes/socket_${socketIndex}/pupil.webp`;
        hasEyeball = await testImageAsset(eyeballPath);
        hasPupil = await testImageAsset(pupilPath);
      }

      if (!hasEyeball && !hasPupil) break;

      console.log(`👁️ [PixiEngine] Discovered Eye Rig: socket_${idxStr} (Eyeball: ${hasEyeball ? 'Yes' : 'No'}, Pupil: ${hasPupil ? 'Yes' : 'No'})`);

      const scleraAlias = `char_${characterId}_eye_sclera_${socketIndex}`;
      const pupilAlias = `char_${characterId}_eye_pupil_${socketIndex}`;

      if (hasEyeball) verifiedLoadQueue.push({ alias: scleraAlias, src: eyeballPath });
      if (hasPupil) verifiedLoadQueue.push({ alias: pupilAlias, src: pupilPath });

      this.discoveredEyes.push({
        id: socketIndex,
        scleraAlias: hasEyeball ? scleraAlias : null,
        pupilAlias: hasPupil ? pupilAlias : null
      });

      socketIndex++;
      if (socketIndex > 30) break;
    }

    // --- Foreground Character Eyelids (Flat in eyes folder) ---
    const eyelidsTopPath = `/assets/actors/${characterId}/eyes/eyelids_top.webp`;
    const eyelidsBottomPath = `/assets/actors/${characterId}/eyes/eyelids_bottom.webp`;
    const hasEyelidsTop = await testImageAsset(eyelidsTopPath);
    const hasEyelidsBottom = await testImageAsset(eyelidsBottomPath);

    if (hasEyelidsTop && hasEyelidsBottom) {
      console.log(`✅ [PixiEngine] Found Flat Eyelid Elements`);
      verifiedLoadQueue.push({ alias: this.keys.eyelids_top, src: eyelidsTopPath });
      verifiedLoadQueue.push({ alias: this.keys.eyelids_bottom, src: eyelidsBottomPath });
      this.hasEyelids = true;
    } else {
      console.warn(`⚠️ [PixiEngine] Eyelids missing (Expected flat eyelids_top.webp and eyelids_bottom.webp inside eyes/ folder)`);
      Assets.cache.set(this.keys.eyelids_top, Texture.EMPTY);
      Assets.cache.set(this.keys.eyelids_bottom, Texture.EMPTY);
    }

    if (verifiedLoadQueue.length > 0) {
      try {
        await Assets.load(verifiedLoadQueue);
        console.log(`%c✅ [PixiEngine] Dynamic asset payload cached!`, 'color: #00ff80; font-weight: bold;');
      } catch (err) {
        console.error("❌ [PixiEngine] Critical Loader Exception:", err);
      }
    }
  }

  buildSceneGraph() {
    const { stage } = this.app;

    this.masterContainer = new Container();
    stage.addChild(this.masterContainer);

    const createSprite = (alias) => {
      const s = Sprite.from(alias);
      s.anchor.set(0.5);
      return s;
    };

    let clipTex = Assets.get(this.keys.char_clipping_mask);
    if (!clipTex || clipTex === Texture.EMPTY) {
      clipTex = Assets.get('bg');
    }
    this.bgHeightScale = (clipTex && clipTex !== Texture.EMPTY) ? clipTex.height : 1000;

    this.masterClipMask = new Graphics()
      .rect(-this.bgHeightScale / 2, -this.bgHeightScale / 2, this.bgHeightScale, this.bgHeightScale)
      .fill({ color: 0xffffff });
    this.masterContainer.addChild(this.masterClipMask);

    this.bgAtmosphereContainer = new Container();
    this.bgAtmosphereContainer.mask = this.masterClipMask;
    this.masterContainer.addChild(this.bgAtmosphereContainer);

    // Instantiate dynamic warp filters directly
    const { warpFilter, bgWarpFilter } = createWarpFilters();
    this.warpFilter = warpFilter;
    this.bgWarpFilter = bgWarpFilter;

    // --- ASSEMBLE BACKGROUND ---
    if (this.isPanoramaMode) {
      const bgTexture = Assets.get('bg');
      if (bgTexture && bgTexture !== Texture.EMPTY) {
        this.layers.bg = new TilingSprite({
          texture: bgTexture,
          width: this.bgHeightScale * 6,
          height: this.bgHeightScale
        });
        this.layers.bg.anchor.set(0.5);
        this.bgAtmosphereContainer.addChild(this.layers.bg);
      }

      if (this.hasBg2) {
        const bg2Texture = Assets.get('bg2');
        if (bg2Texture && bg2Texture !== Texture.EMPTY) {
          this.layers.bg2 = new TilingSprite({
            texture: bg2Texture,
            width: this.bgHeightScale * 6,
            height: this.bgHeightScale
          });
          this.layers.bg2.anchor.set(0.5);
          this.bgAtmosphereContainer.addChild(this.layers.bg2);
        }
      }
    } else {
      // 1. Solid Backdrop Color
      if (this.hasBgClippingMask) {
        this.layers.bg_clip = createSprite(this.keys.bg_clipping_mask);
        this.bgAtmosphereContainer.addChild(this.layers.bg_clip);
      }

      // 2. Background warp patterns container (Applied directly)
      const hasAnyBgPat = this.hasBgPat1 || this.hasBgPat2;
      if (hasAnyBgPat) {
        this.bgPatternsContainer = new Container();
        this.bgPatternsContainer.filters = [this.bgWarpFilter];
        this.bgAtmosphereContainer.addChild(this.bgPatternsContainer);

        // Pattern bottom (bg_pat_2) renders underneath pattern top (bg_pat_1)
        if (this.hasBgPat2) {
          const sp2 = createSprite(this.keys.bg_pat_2);
          this.bgPatternsContainer.addChild(sp2);
        }
        if (this.hasBgPat1) {
          const sp1 = createSprite(this.keys.bg_pat_1);
          this.bgPatternsContainer.addChild(sp1);
        }
      }

      // 3. Mountains graphic
      if (this.hasBgMountain) {
        this.layers.bg_mountain = createSprite(this.keys.bg_mountain);
        this.bgAtmosphereContainer.addChild(this.layers.bg_mountain);
      }
    }

    // Particles
    this.particleSystem = new ParticleSystem(this.app.renderer, this.bgAtmosphereContainer, this.bgHeightScale);
    
    // --- ASSEMBLE CHARACTER ---
    this.headContainer = new Container();
    this.masterContainer.addChild(this.headContainer);

    // Blurry shadow glow container (renders underneath)
    if (this.hasCharClippingMask) {
      this.layers.aura = createSprite(this.keys.char_clipping_mask);
      this.headContainer.addChild(this.layers.aura);
    }

    // Nested composition to decouple filters from the mask sprite
    if (this.hasCharClippingMask) {
      // 1. The mask sprite (must be set as renderable=false so it does not draw as a solid colored block)
      const charMaskSprite = createSprite(this.keys.char_clipping_mask);
      charMaskSprite.renderable = false; 
      this.headContainer.addChild(charMaskSprite);

      // 2. The wrapped container applying only the clip-mask
      this.characterContentContainer = new Container();
      
      // Use setMask with channel: 'alpha' to bypass color channel processing (fixes purple alpha muffling)
      this.characterContentContainer.setMask({
        mask: charMaskSprite,
        channel: 'alpha'
      });
      
      this.headContainer.addChild(this.characterContentContainer);

      // 3. Render base color (clipping mask file acting as character color) inside masked wrapper
      this.layers.base = createSprite(this.keys.char_clipping_mask);
      this.characterContentContainer.addChild(this.layers.base);

      // 4. Render character patterns container inside masked wrapper (warp applied with zero mask conflicts)
      if (this.discoveredPatterns.length > 0) {
        this.patternsContainer = new Container();
        this.patternsContainer.filters = [this.warpFilter]; 
        this.characterContentContainer.addChild(this.patternsContainer);

        // Render ascending chronological layers (Pattern 1 on bottom, Pattern 2 on top)
        for (const patternAlias of this.discoveredPatterns) {
          const sp = createSprite(patternAlias);
          this.patternsContainer.addChild(sp);
        }
      }
    }

    // Attach glow behaviors
    this.effectsSystem.attach({
      headContainer: this.headContainer,
      auraSprite: this.layers.aura,
      baseSprite: this.layers.base
    });

    // Render lineart & teeth
    if (this.hasLineart) {
      this.layers.lineart = createSprite(this.keys.char_lineart);
      this.headContainer.addChild(this.layers.lineart);
    }

    // Render eyeballs and lids
    this.eyeSystem = new EyeSystem(this.headContainer, {
      discoveredEyes: this.discoveredEyes,
      hasEyelids: this.hasEyelids,
      eyelidsTopAlias: this.hasEyelids ? this.keys.eyelids_top : null,
      eyelidsBottomAlias: this.hasEyelids ? this.keys.eyelids_bottom : null
    });
  }

  async reloadAssetsAndScene() {
    this.isReady = false;

    if (this.masterContainer) {
      this.masterContainer.destroy({ children: true, texture: false });
      this.masterContainer = null;
    }

    if (this.eyeSystem?.destroy) {
      this.eyeSystem.destroy();
    }
    if (this.particleSystem?.destroy) {
      this.particleSystem.destroy();
    }

    await this.loadAssets();

    if (this.isDestroyed) return;

    this.buildSceneGraph();
    this.resize();
    this.isReady = true;
  }

  update(deltaTime) {
    if (!this.isReady) return;
    const dtSeconds = deltaTime / 60;
    this.time += dtSeconds;

    const config = this.config;
    const { isGlitched, currentSplit } = this.effectsSystem.update(this.time, config);

    const tFloat = this.time * config.floatSpeed;
    let floatX = Math.sin(tFloat) * config.floatAmpX;
    let floatY = Math.sin(2 * tFloat) * config.floatAmpY;
    const rotation = Math.cos(tFloat) * config.floatRotation * (Math.PI / 180);

    if (config.glitchShakeIntensity > 0 && (isGlitched || currentSplit > (config.aberrationAmount * 1.15))) {
        floatX += (Math.random() - 0.5) * config.glitchShakeIntensity;
        floatY += (Math.random() - 0.5) * config.glitchShakeIntensity;
    }
    this.headContainer.position.set(floatX, floatY);
    this.headContainer.rotation = rotation;

    // --- Dynamic Scaling & Warp Shading for Background Patterns ---
    if (this.bgPatternsContainer && this.bgPatternsContainer.children.length > 0) {
      const kids = this.bgPatternsContainer.children;
      if (kids.length === 1) {
        kids[0].scale.set(config.bgPatternTopScale);
      } else if (kids.length > 1) {
        // kids[0] is background bottom (index 0), kids[1] is background top (index 1)
        kids[0].scale.set(config.bgPatternBottomScale);
        kids[1].scale.set(config.bgPatternTopScale);
      }

      if (this.bgWarpFilter && this.bgWarpFilter.resources.warpUniforms) {
        this.bgWarpFilter.resources.warpUniforms.uniforms.uTime = this.time * config.bgWarpSpeed;
        this.bgWarpFilter.resources.warpUniforms.uniforms.uWarpIntensity = config.bgWarpIntensity;
      }
    }

    // --- Dynamic Scaling & Warp Shading for Character Patterns ---
    if (this.patternsContainer && this.patternsContainer.children.length > 0) {
      const kids = this.patternsContainer.children;
      if (kids.length === 1) {
        kids[0].scale.set(config.patternTopScale);
      } else if (kids.length > 1) {
        // kids[0] is pattern_1 (bottom)
        kids[0].scale.set(config.patternBottomScale); // pattern_1 (lowest number) maps to patternBottomScale
        kids[kids.length - 1].scale.set(config.patternTopScale); // pattern_N maps to patternTopScale
        for (let i = 1; i < kids.length - 1; i++) {
          kids[i].scale.set((config.patternBottomScale + config.patternTopScale) / 2);
        }
      }

      if (this.warpFilter && this.warpFilter.resources.warpUniforms) {
        this.warpFilter.resources.warpUniforms.uniforms.uTime = this.time * config.warpSpeed;
        this.warpFilter.resources.warpUniforms.uniforms.uWarpIntensity = config.warpIntensity;
      }
    }

    if (this.eyeSystem) {
      this.eyeSystem.update(deltaTime, config);
    }

    if (this.particleSystem) {
      this.particleSystem.update(deltaTime, config);
    }

    if (this.isPanoramaMode) {
      const baseSpeed = config.bgScrollSpeed;
      if (this.layers.bg) {
        this.layers.bg.tilePosition.x -= baseSpeed * dtSeconds;
      }
      if (this.hasBg2 && this.layers.bg2) {
        this.layers.bg2.tilePosition.x -= (baseSpeed * config.bg2ParallaxSpeed) * dtSeconds;
      }
    }
  }

  resize() {
    if(!this.app || !this.app.renderer || !this.masterContainer) return;
    this.app.renderer.resize(window.innerWidth, window.innerHeight);
    const { screen } = this.app;
    
    this.masterContainer.position.set(screen.width / 2, screen.height / 2);
    
    const clipTex = Assets.get(this.keys.char_clipping_mask) || Assets.get('bg');
    const bgWidth = (clipTex && clipTex !== Texture.EMPTY) ? clipTex.width : 1000;
    const bgHeight = (clipTex && clipTex !== Texture.EMPTY) ? clipTex.height : 1000;

    const scaleX = screen.width / bgWidth;
    const scaleY = screen.height / bgHeight;
    const scale = Math.max(scaleX, scaleY);
    
    this.masterContainer.scale.set(scale);

    if (this.masterClipMask) {
      const localW = screen.width / scale;
      const localH = screen.height / scale;
      this.masterClipMask.clear()
        .rect(-localW / 2, -localH / 2, localW, localH)
        .fill({ color: 0xffffff });
    }
  }

  destroy() {
    this.isDestroyed = true;

    if (this.unsubscribeStore) {
      this.unsubscribeStore();
    }

    if (this.isReady && this.app) {
      try { 
        if (this.eyeSystem?.destroy) {
          this.eyeSystem.destroy();
        }
        if (this.particleSystem?.destroy) {
          this.particleSystem.destroy();
        }
        this.app.destroy(true, { children: true, texture: true }); 
      } catch (e) {
        console.warn("[PixiEngine] Strict cleanup warn:", e);
      }
    }
  }
}