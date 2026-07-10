// src/engine/PixiEngine.js
import { 
  Application, 
  Assets, 
  Container, 
  Sprite,
  Texture,
  Graphics
} from 'pixi.js';
import { useStore } from '../store/useStore.js';
import { EffectsSystem } from './systems/EffectsSystem.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { EyeSystem } from './systems/EyeSystem.js';
import { FogSystem } from './systems/FogSystem.js';
import { RenderTextureManager } from './systems/RenderTextureManager.js';
import { MirroredScrollLayer } from './systems/MirroredScrollLayer.js';

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

    // Load sequence counter to prevent overlapping asynchronous loading glitches
    this.loadSequence = 0;

    // Direct existential flags
    this.hasBgClippingMask = false;
    this.hasBgMountain = false;
    this.hasBgMountainBack = false;
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
    this.renderTextureManager = null;
    this.bgFog = null;
    this.fgFog = null;

    // Internal mouse state bypassed from Zustand
    this.mousePos = { x: 0, y: 0 };

    this.config = { ...useStore.getState() };

    this.unsubscribeStore = useStore.subscribe((state) => {
      const prevChar = this.config.characterId;
      const prevBgClip = this.config.bgClippingMaskId;
      const prevBgStyle = this.config.bgPatternStyle;
      const prevBgMountain = this.config.bgMountainId;
      const prevBgMountainBack = this.config.bgMountainBackId;

      this.config = state;

      if (
        prevChar !== state.characterId ||
        prevBgClip !== state.bgClippingMaskId ||
        prevBgStyle !== state.bgPatternStyle ||
        prevBgMountain !== state.bgMountainId ||
        prevBgMountainBack !== state.bgMountainBackId
      ) {
        this.reloadAssetsAndScene().catch(err => console.error("Re-init assets failed:", err));
      }
    });
  }

  updateMousePos(x, y) {
    this.mousePos.x = x;
    this.mousePos.y = y;
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
      
      const currentSeq = ++this.loadSequence;
      await this.loadAssets();

      if (this.isDestroyed || currentSeq !== this.loadSequence) {
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
    const { characterId, bgClippingMaskId, bgPatternStyle, bgMountainId, bgMountainBackId } = this.config;
    const verifiedLoadQueue = [];

    this.discoveredPatterns = [];
    this.discoveredEyes = [];
    this.hasEyelids = false;
    this.isPanoramaMode = false;
    this.hasBg2 = false;
    this.hasBgMountainBack = false;

    console.log(`%c🔍 [PixiEngine] Rig Loader: Locating Stage Assets`, 'color: #00f3ff; font-weight: bold;');

    // Normalize IDs to padded 2-digit strings (e.g. 1 -> "01", 2 -> "02")
    const padId = (id) => typeof id === 'number' ? String(id).padStart(2, '0') : id;
    const formattedMountainId = padId(bgMountainId);
    const formattedMountainBackId = padId(bgMountainBackId);

    this.keys = {
      bg_clipping_mask: `bg_clipping_mask_${bgClippingMaskId}`,
      bg_pat_1: `bg_pat_1_${bgPatternStyle}`,
      bg_pat_2: `bg_pat_2_${bgPatternStyle}`,
      bg_mountain: `bg_mountain_${formattedMountainId}`,
      bg_mountain_back: `bg_mountain_back_${formattedMountainBackId}`,
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

      // 3. Foreground Mountains Layer
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

      // 4. Background Mountains Layer (NEW)
      let mountainBackPath = `/assets/stage/mountains/mountain_${formattedMountainBackId}.webp`;
      this.hasBgMountainBack = await testImageAsset(mountainBackPath);
      if (!this.hasBgMountainBack) {
        mountainBackPath = `/assets/stage/mountains/mountain_${bgMountainBackId}.webp`;
        this.hasBgMountainBack = await testImageAsset(mountainBackPath);
      }
      if (this.hasBgMountainBack) {
        console.log(`✅ [PixiEngine] Back Mountain Graphic: ${mountainBackPath}`);
        verifiedLoadQueue.push({ alias: this.keys.bg_mountain_back, src: mountainBackPath });
      } else {
        console.warn(`⚠️ [PixiEngine] Missing Back Mountain Asset at: /assets/stage/mountains/mountain_${formattedMountainBackId}.webp`);
        Assets.cache.set(this.keys.bg_mountain_back, Texture.EMPTY);
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

    // --- Foreground Character Patterns ---
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

    // --- Foreground Character Dynamic Eye Sockets ---
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

    // --- Foreground Character Eyelids ---
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

    // Initialize the off-screen RenderTextureManager to flatten warp filters
    this.renderTextureManager = new RenderTextureManager({
      discoveredPatterns: this.discoveredPatterns,
      bgPat1Alias: this.hasBgPat1 ? this.keys.bg_pat_1 : null,
      bgPat2Alias: this.hasBgPat2 ? this.keys.bg_pat_2 : null,
      hasBgPat1: this.hasBgPat1,
      hasBgPat2: this.hasBgPat2
    });

    // --- ASSEMBLE BACKGROUND ---
    if (this.isPanoramaMode) {
      const bgTexture = Assets.get('bg');
      if (bgTexture && bgTexture !== Texture.EMPTY) {
        this.layers.bg = new MirroredScrollLayer(bgTexture, this.bgHeightScale, 1.0);
        this.bgAtmosphereContainer.addChild(this.layers.bg);
      }

      if (this.hasBg2) {
        const bg2Texture = Assets.get('bg2');
        if (bg2Texture && bg2Texture !== Texture.EMPTY) {
          this.layers.bg2 = new MirroredScrollLayer(bg2Texture, this.bgHeightScale, this.config.bg2ParallaxSpeed);
          this.bgAtmosphereContainer.addChild(this.layers.bg2);
        }
      }
    } else {
      // 1. Solid Backdrop Color
      if (this.hasBgClippingMask) {
        this.layers.bg_clip = createSprite(this.keys.bg_clipping_mask);
        this.bgAtmosphereContainer.addChild(this.layers.bg_clip);
      }

      // 2. Off-Screen RenderTexture Warp patterns
      const hasAnyBgPat = this.hasBgPat1 || this.hasBgPat2;
      if (hasAnyBgPat && this.renderTextureManager) {
        this.bgAtmosphereContainer.addChild(this.renderTextureManager.bgPatternSprite);
      }

      // 3. Back Mountains layer (Further away, slower scroll rate, higher vertical coordinate offset, hazy opacity)
      if (this.hasBgMountainBack) {
        const mountainBackTex = Assets.get(this.keys.bg_mountain_back);
        if (mountainBackTex && mountainBackTex !== Texture.EMPTY) {
          this.layers.bg_mountain_back = new MirroredScrollLayer(mountainBackTex, this.bgHeightScale, 0.18);
          this.layers.bg_mountain_back.position.y = -35; // Shifts upward to align behind front range
          this.layers.bg_mountain_back.alpha = 0.75; // Atmospheric perspective haze
          this.bgAtmosphereContainer.addChild(this.layers.bg_mountain_back);
        }
      }

      // 4. Foreground Mountains layer (Closer range, standard scroll rate)
      if (this.hasBgMountain) {
        const mountainTex = Assets.get(this.keys.bg_mountain);
        if (mountainTex && mountainTex !== Texture.EMPTY) {
          this.layers.bg_mountain = new MirroredScrollLayer(mountainTex, this.bgHeightScale, 0.4);
          this.bgAtmosphereContainer.addChild(this.layers.bg_mountain);
        }
      }
    }

    // Decoupled Background Fog Layer
    this.bgFog = new FogSystem(this.bgAtmosphereContainer, this.bgHeightScale, false);

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
      
      // Use setMask with channel: 'alpha' to bypass color channel processing
      this.characterContentContainer.setMask({
        mask: charMaskSprite,
        channel: 'alpha'
      });
      
      this.headContainer.addChild(this.characterContentContainer);

      // 3. Render base color (clipping mask file acting as character color) inside masked wrapper
      this.layers.base = createSprite(this.keys.char_clipping_mask);
      this.characterContentContainer.addChild(this.layers.base);

      // 4. Render character patterns using flattened textures
      if (this.discoveredPatterns.length > 0 && this.renderTextureManager) {
        this.characterContentContainer.addChild(this.renderTextureManager.patternSprite);
      }
    }

    // Attach glow behaviors
    this.effectsSystem.attach({
      headContainer: this.headContainer,
      auraSprite: this.layers.aura,
      baseSprite: this.layers.base
    });

    // Render lineart
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

    // Decoupled Foreground Fog Layer (placed on top of character but below overlays)
    this.fgFog = new FogSystem(this.masterContainer, this.bgHeightScale, true);
  }

  async reloadAssetsAndScene() {
    this.isReady = false;

    // Capture sequence to discard out-of-order stale operations
    const currentSeq = ++this.loadSequence;

    // 1. Destroy active subsystems FIRST so they can safely release graphics/WebGL resources
    if (this.eyeSystem?.destroy) {
      this.eyeSystem.destroy();
    }
    if (this.particleSystem?.destroy) {
      this.particleSystem.destroy();
    }
    if (this.renderTextureManager?.destroy) {
      this.renderTextureManager.destroy();
      this.renderTextureManager = null;
    }
    if (this.bgFog?.destroy) {
      this.bgFog.destroy();
      this.bgFog = null;
    }
    if (this.fgFog?.destroy) {
      this.fgFog.destroy();
      this.fgFog = null;
    }

    // 2. Safely dispose of the main rendering display tree
    if (this.masterContainer) {
      this.masterContainer.destroy({ children: true, texture: false });
      this.masterContainer = null;
    }

    await this.loadAssets();

    if (this.isDestroyed || currentSeq !== this.loadSequence) {
      return;
    }

    this.buildSceneGraph();
    this.resize();
    this.isReady = true;
  }

  update(deltaTime) {
    if (!this.isReady) return;
    const dtSeconds = deltaTime / 60;
    this.time += dtSeconds;

    // Synthesize latest coordinates dynamically so that EyeSystem and nested modules receive updates
    const config = { ...this.config, mousePos: this.mousePos };
    const { isGlitched, currentSplit } = this.effectsSystem.update(this.time, config);

    // --- Custom Flight & Hover Calculations ---
    const tFloat = this.time * config.floatSpeed;

    // Employs a smoothstep curve over clamped waves to generate hover pauses (plateaus) at extrema
    const rawWave = Math.sin(tFloat) * config.flyHoverPause;
    const clampedWave = Math.max(-1, Math.min(1, rawWave));
    
    // Normalizes clamped wave range to [0.0, 1.0] for linear progress interpolation
    const normProgress = clampedWave * 0.5 + 0.5; 
    const smoothProgress = normProgress * normProgress * (3 - 2 * normProgress);

    // Apply vertical displacement limits (0 is the lowest, config.floatAmpY is the highest elevation)
    let floatY = -(smoothProgress * config.floatAmpY * 1.5);
    
    // Horizontal sway
    let floatX = Math.cos(tFloat * 0.5) * config.floatAmpX;

    if (config.glitchShakeIntensity > 0 && (isGlitched || currentSplit > (config.aberrationAmount * 1.15))) {
        floatX += (Math.random() - 0.5) * config.glitchShakeIntensity;
        floatY += (Math.random() - 0.5) * config.glitchShakeIntensity;
    }
    this.headContainer.position.set(floatX, floatY);

    // Dynamic scale: transitions from flyMinScale (bottom) to flyMaxScale (peak)
    const currentScale = config.flyMinScale - (smoothProgress * (config.flyMinScale - config.flyMaxScale));
    this.headContainer.scale.set(currentScale);

    // Dynamic rotation: persistent angle bias tilt + slow swaying around bias center
    const tiltRad = config.flyTiltBias * (Math.PI / 180);
    const swayOsc = Math.sin(tFloat * 0.7) * (config.floatRotation * 0.5) * (Math.PI / 180);
    this.headContainer.rotation = tiltRad + swayOsc;

    // Update off-screen RenderTextureManager pass for warp filters
    if (this.renderTextureManager) {
      this.renderTextureManager.update(deltaTime, config, this.app.renderer);
    }

    // Update decoupled background and foreground fog systems
    if (this.bgFog) {
      this.bgFog.update(this.time, config);
    }
    if (this.fgFog) {
      this.fgFog.update(this.time, config);
    }

    if (this.eyeSystem) {
      this.eyeSystem.update(deltaTime, config);
    }

    if (this.particleSystem) {
      this.particleSystem.update(deltaTime, config);
    }

    // --- Background Side Scrolling Parallax Updates ---
     // --- Background Side Scrolling (Double Layer Parallax) ---
    const baseSpeed = config.bgScrollSpeed;
    const backParallax = config.bg2ParallaxSpeed; // The slider value (supports negative ranges)

    if (this.isPanoramaMode) {
      if (this.layers.bg) {
        this.layers.bg.updatePositions(dtSeconds, baseSpeed, 1.0);
      }
      if (this.layers.bg2) {
        this.layers.bg2.updatePositions(dtSeconds, baseSpeed, backParallax);
      }
    } else {
      if (this.layers.bg_mountain_back) {
        // Multiplies the back mountain's base speed factor by your custom slider value
        // Moving the slider to 0.0 halts it, and negative values reverse its direction
        this.layers.bg_mountain_back.updatePositions(dtSeconds, baseSpeed, 0.15 * backParallax);
      }
      if (this.layers.bg_mountain) {
        this.layers.bg_mountain.updatePositions(dtSeconds, baseSpeed, 0.40);
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
        if (this.renderTextureManager?.destroy) {
          this.renderTextureManager.destroy();
          this.renderTextureManager = null;
        }
        if (this.bgFog?.destroy) {
          this.bgFog.destroy();
          this.bgFog = null;
        }
        if (this.fgFog?.destroy) {
          this.fgFog.destroy();
          this.fgFog = null;
        }
        this.app.destroy(true, { children: true, texture: true }); 
      } catch (e) {
        console.warn("[PixiEngine] Strict cleanup warn:", e);
      }
    }
  }
}