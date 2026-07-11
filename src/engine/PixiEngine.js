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
import { AssetResolver } from './assets/AssetResolver.js';
import { FlightDynamics } from './systems/FlightDynamics.js';
import { ShockwaveSystem } from './systems/ShockwaveSystem.js';
import { TrailSystem } from './systems/TrailSystem.js';
import { SearchlightSystem } from './systems/SearchlightSystem.js';

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

    // Systems Allocation
    this.effectsSystem = new EffectsSystem();
    this.eyeSystem = null;
    this.particleSystem = null;
    this.renderTextureManager = null;
    this.bgFog = null;
    this.fgFog = null;
    
    // Subsystem Coordinators
    this.flightDynamics = new FlightDynamics();
    this.shockwaveSystem = null;
    this.trailSystem = null;
    this.searchlightSystem = null;

    this.lastGlitchPeak = false;

    // Double Mouse Tracker: Separate absolute screen-coords and normalized [-1, 1] scales
    this.absoluteMousePos = { x: 0, y: 0 };
    this.normalizedMousePos = { x: 0, y: 0 };

    // Spring Drift Navigation State Variables (New) [3]
    this.baselinePosition = { x: 0, y: 0 };   // The floating anchor position
    this.targetPosition = { x: 0, y: 0 };     // The destination coordinates set on click
    this.isMovingToTarget = false;            // Movement status flag
    this.facingDirection = 1.0;               // Target flip direction (1.0 = right, -1.0 = left)
    this.currentFlipScale = 1.0;              // Smoothly interpolated flip scale ratio

    this.config = { ...useStore.getState() };

    this.unsubscribeStore = useStore.subscribe((state) => {
      const prevChar = this.config.characterId;
      const prevBgClip = this.config.bgClippingMaskId;
      const prevBgStyle = this.config.bgPatternStyle;
      const prevBgMountain = this.config.bgMountainId;
      const prevBgMountainBack = this.config.bgMountainBackId;

      const prevReaction = this.config.activeReaction;
      const nextReaction = state.activeReaction;
      const prevProgress = this.config.reactionProgress;
      const nextProgress = state.reactionProgress;

      this.config = state;

      // Detect transaction start or restart trigger signals
      if (nextReaction !== null && (prevReaction !== nextReaction || nextProgress === 1.0)) {
        this.startLocalReaction(nextReaction);
      }

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

  /**
   * Tracks target coordinates relative to the screen dimensions.
   * @param {number} clientX - World horizontal position.
   * @param {number} clientY - World vertical position.
   */
  updateMousePos(clientX, clientY) {
    this.absoluteMousePos.x = clientX;
    this.absoluteMousePos.y = clientY;

    // Normalize coordinates to [-1, 1] range to avoid breaking pupil wander scripts
    this.normalizedMousePos.x = (clientX / window.innerWidth) * 2 - 1;
    this.normalizedMousePos.y = (clientY / window.innerHeight) * 2 - 1;
  }

  /**
   * Triggers the organic spring-easing drift animation towards the clicked target coordinates [3].
   * @param {number} clientX - Absolute canvas click horizontal position.
   * @param {number} clientY - Absolute canvas click vertical position.
   */
  updateMouseClick(clientX, clientY) {
    if (!this.masterContainer) return;
    
    // Convert global screen pixel coordinates into master relative coordinates [3]
    const localTarget = this.masterContainer.toLocal({ x: clientX, y: clientY });
    this.targetPosition.x = localTarget.x;
    this.targetPosition.y = localTarget.y;
    this.isMovingToTarget = true;
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
    console.log(`%c🔍 [PixiEngine] Rig Loader: Locating Stage Assets`, 'color: #00f3ff; font-weight: bold;');
    
    const results = await AssetResolver.resolveRig(this.config);
    
    this.keys = results.keys;
    this.hasBgClippingMask = results.hasBgClippingMask;
    this.hasBgPat1 = results.hasBgPat1;
    this.hasBgPat2 = results.hasBgPat2;
    this.hasBgMountain = results.hasBgMountain;
    this.hasBgMountainBack = results.hasBgMountainBack;
    this.hasCharClippingMask = results.hasCharClippingMask;
    this.hasLineart = results.hasLineart;
    this.hasEyelids = results.hasEyelids;
    this.isPanoramaMode = results.isPanoramaMode;
    this.hasBg2 = results.hasBg2;
    this.discoveredPatterns = results.discoveredPatterns;
    this.discoveredEyes = results.discoveredEyes;

    if (results.verifiedLoadQueue.length > 0) {
      try {
        await Assets.load(results.verifiedLoadQueue);
        console.log("%c✅ [PixiEngine] Dynamic asset payload cached!", 'color: #00ff80; font-weight: bold;');
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

    // Initialise Shockwave System
    this.shockwaveSystem = new ShockwaveSystem();

    // Initialize the off-screen RenderTextureManager to flatten warp patterns
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

        // Ceiling reflection overlay (screen blended duplicate of offscreen render texture)
        this.layers.bg_pattern_reflect = new Sprite(this.renderTextureManager.bgPatternRenderTexture);
        this.layers.bg_pattern_reflect.anchor.set(0.5);
        this.layers.bg_pattern_reflect.blendMode = 'screen';
        this.bgAtmosphereContainer.addChild(this.layers.bg_pattern_reflect);
      }

      // 3. Back Mountains layer
      if (this.hasBgMountainBack) {
        const mountainBackTex = Assets.get(this.keys.bg_mountain_back);
        if (mountainBackTex && mountainBackTex !== Texture.EMPTY) {
          this.layers.bg_mountain_back = new MirroredScrollLayer(mountainBackTex, this.bgHeightScale, 0.18);
          this.layers.bg_mountain_back.position.y = -35; // Shifts upward to align behind front range
          this.layers.bg_mountain_back.alpha = 0.75; // Atmospheric perspective haze
          this.bgAtmosphereContainer.addChild(this.layers.bg_mountain_back);

          // Dynamic Cavern Lighting: Back Mountain Reflector Duplicate
          this.layers.bg_mountain_back_reflect = new MirroredScrollLayer(mountainBackTex, this.bgHeightScale, 0.18);
          this.layers.bg_mountain_back_reflect.position.y = -35;
          this.layers.bg_mountain_back_reflect.blendMode = 'screen';
          this.bgAtmosphereContainer.addChild(this.layers.bg_mountain_back_reflect);
        }
      }

      // 4. Foreground Mountains layer
      if (this.hasBgMountain) {
        const mountainTex = Assets.get(this.keys.bg_mountain);
        if (mountainTex && mountainTex !== Texture.EMPTY) {
          this.layers.bg_mountain = new MirroredScrollLayer(mountainTex, this.bgHeightScale, 0.4);
          this.bgAtmosphereContainer.addChild(this.layers.bg_mountain);

          // Dynamic Cavern Lighting: Foreground Mountain Reflector Duplicate
          this.layers.bg_mountain_reflect = new MirroredScrollLayer(mountainTex, this.bgHeightScale, 0.4);
          this.layers.bg_mountain_reflect.blendMode = 'screen';
          this.bgAtmosphereContainer.addChild(this.layers.bg_mountain_reflect);
        }
      }
    }

    // Decoupled Background Fog Layer
    this.bgFog = new FogSystem(this.bgAtmosphereContainer, this.bgHeightScale, false);

    // Particles
    this.particleSystem = new ParticleSystem(this.app.renderer, this.bgAtmosphereContainer, this.bgHeightScale);
    
    // Initialise Ghost Coordinates System
    this.trailSystem = new TrailSystem(this.masterContainer, this.hasCharClippingMask ? this.keys.char_clipping_mask : null);

    // Initialize Volumetric Searchlight System
    this.searchlightSystem = new SearchlightSystem(this.masterContainer);

    // 2. Head Container
    this.headContainer = new Container();
    this.masterContainer.addChild(this.headContainer);

    // Blurry shadow glow container (renders underneath head lineart/features)
    if (this.hasCharClippingMask) {
      this.layers.aura = createSprite(this.keys.char_clipping_mask);
      this.headContainer.addChild(this.layers.aura);
    }

    // Nested composition to decouple filters from the mask sprite
    if (this.hasCharClippingMask) {
      // The mask sprite (must be set as renderable=false so it does not draw as a solid colored block)
      const charMaskSprite = createSprite(this.keys.char_clipping_mask);
      charMaskSprite.renderable = false; 
      this.headContainer.addChild(charMaskSprite);

      // The wrapped container applying only the clip-mask
      this.characterContentContainer = new Container();
      
      // Use setMask with channel: 'alpha' to bypass color channel processing
      this.characterContentContainer.setMask({
        mask: charMaskSprite,
        channel: 'alpha'
      });
      
      this.headContainer.addChild(this.characterContentContainer);

      // Render base color (clipping mask file acting as character color) inside masked wrapper
      this.layers.base = createSprite(this.keys.char_clipping_mask);
      this.characterContentContainer.addChild(this.layers.base);

      // Render character patterns using flattened textures
      if (this.discoveredPatterns.length > 0 && this.renderTextureManager) {
        this.characterContentContainer.addChild(this.renderTextureManager.patternSprite);
      }
    }

    // Attach glow, dynamic cavern lighting, and filters
    this.effectsSystem.attach({
      headContainer: this.headContainer,
      auraSprite: this.layers.aura,
      baseSprite: this.layers.base,
      mountainReflector: this.layers.bg_mountain_reflect,
      mountainBackReflector: this.layers.bg_mountain_back_reflect,
      ceilingReflector: this.layers.bg_pattern_reflect
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
    if (this.trailSystem?.destroy) {
      this.trailSystem.destroy();
      this.trailSystem = null;
    }
    if (this.shockwaveSystem?.destroy) {
      this.shockwaveSystem.destroy();
      this.shockwaveSystem = null;
    }
    if (this.searchlightSystem?.destroy) {
      this.searchlightSystem.destroy();
      this.searchlightSystem = null;
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

  /**
   * Assigns local animation properties to smoothly transition visually during triggered reactions.
   */
  startLocalReaction(reactionType) {
    this.originalPreset = {
      aberrationAmount: this.config.aberrationAmount,
      warpIntensity: this.config.warpIntensity,
      particleCount: this.config.particleCount,
      particleSpeed: this.config.particleSpeed,
      auraOpacity: this.config.auraOpacity,
      auraScale: this.config.auraScale,
      glitchShakeIntensity: this.config.glitchShakeIntensity,
      flickerIntensity: this.config.flickerIntensity,
      aberrationSpeed: this.config.aberrationSpeed,
      aberrationGlitch: this.config.aberrationGlitch
    };

    this.currentLocalReaction = reactionType;
    this.localReactionProgress = 1.0;

    // Direct WebGL ripples trigger
    if (this.shockwaveSystem && this.headContainer) {
      this.shockwaveSystem.trigger(
        this.headContainer.position,
        this.masterContainer.scale.x,
        this.app.screen.width,
        this.app.screen.height
      );
    }
  }

  update(deltaTime) {
    if (!this.isReady) return;
    const dtSeconds = deltaTime / 60;
    this.time += dtSeconds;

    // --- Phase 2: Internal Reaction Decay Step ---
    if (this.currentLocalReaction && this.originalPreset) {
      this.localReactionProgress -= 0.007 * deltaTime;

      if (this.localReactionProgress <= 0) {
        this.localReactionProgress = 0;
        this.currentLocalReaction = null;
        this.originalPreset = null;

        // Reset the store values once when the decay concludes [3]
        const setParameter = useStore.getState().setParameter;
        setParameter("activeReaction", null);
        setParameter("reactionProgress", 0.0);
      } else {
        // Sync progress dynamically to the store so the Tab indicator updates [3]
        useStore.getState().setParameter("reactionProgress", this.localReactionProgress);
      }
    }

    // --- Spring Drift Navigation & 3D Flipping Calculations [3] ---
    if (this.isMovingToTarget) {
      const dx = this.targetPosition.x - this.baselinePosition.x;
      const dy = this.targetPosition.y - this.baselinePosition.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 15) {
        // Stop active drifting once reached, dropping back into default baseline hover [3]
        this.isMovingToTarget = false;
      } else {
        // Smoothly ease baseline position vectors towards target click [3]
        this.baselinePosition.x += dx * 0.0071 * deltaTime;
        this.baselinePosition.y += dy * 0.0071 * deltaTime;

        // Establish target face vector (1.0 = Right, -1.0 = Left) [3]
        this.facingDirection = dx > 0 ? 1.0 : -1.0;
      }
    }

    // Smoothly ease active horizontal scale ratios to simulate 3D rotational flipping [3]
    this.currentFlipScale += (this.facingDirection - this.currentFlipScale) * 0.2 * deltaTime;

    // Synthesize latest coordinates dynamically so that EyeSystem and nested modules receive updates
    const config = { ...this.config, mousePos: this.normalizedMousePos };

    // Apply internal decay overrides over baseline configurations [3]
    if (this.currentLocalReaction && this.originalPreset) {
      const invProgress = this.localReactionProgress;

      if (this.currentLocalReaction === "lyx_received") {
        config.particleCount = Math.floor(this.originalPreset.particleCount + (300 - this.originalPreset.particleCount) * invProgress);
        config.particleSpeed = this.originalPreset.particleSpeed + (4.5 - this.originalPreset.particleSpeed) * invProgress;
        config.auraOpacity = this.originalPreset.auraOpacity + (1.0 - this.originalPreset.auraOpacity) * invProgress;
        config.auraScale = this.originalPreset.auraScale + (1.35 - this.originalPreset.auraScale) * invProgress;
        config.warpIntensity = this.originalPreset.warpIntensity + (50.0 - this.originalPreset.warpIntensity) * invProgress;
      } 
      else if (this.currentLocalReaction === "lsp7_received" || this.currentLocalReaction === "lsp8_received") {
        config.aberrationAmount = this.originalPreset.aberrationAmount + (30.0 - this.originalPreset.aberrationAmount) * invProgress;
        config.warpIntensity = this.originalPreset.warpIntensity + (90.0 - this.originalPreset.warpIntensity) * invProgress;
        config.glitchShakeIntensity = Math.floor(this.originalPreset.glitchShakeIntensity + (25 - this.originalPreset.glitchShakeIntensity) * invProgress);
        config.flickerIntensity = this.originalPreset.flickerIntensity + (0.85 - this.originalPreset.flickerIntensity) * invProgress;
        
        config.aberrationSpeed = 8.0;
        config.aberrationGlitch = 0;
      }
    }

    config.reactionProgress = this.localReactionProgress;

    const { isGlitched, currentSplit } = this.effectsSystem.update(this.time, config);

    // --- Flight & Hover Subsystem Calculations ---
    const isGlitchActive = (isGlitched || currentSplit > (config.aberrationAmount * 1.15));
    
    // Pass baseline and flip parameters to the flight coordinator [3]
    const headState = this.flightDynamics.calculate(this.time, config, isGlitchActive, this.baselinePosition, this.currentFlipScale);

    this.headContainer.position.set(headState.x, headState.y);
    this.headContainer.scale.set(headState.scaleX, headState.scale); // Independent scale assignment to allow horizontal flip rotations [3]
    this.headContainer.rotation = headState.rotation;

    // --- Searchlight Volumetric System Updates (Orbiting turret tracking mouse) ---
    if (this.searchlightSystem) {
      // Pass the float positions of the head to establish the relative center, and the direct absolute mouse coordinates [3]
      this.searchlightSystem.update(this.headContainer.position, this.absoluteMousePos, deltaTime, config);
    }

    // --- WebGL Portal Refraction Ripple Subsystem updates ---
    if (this.shockwaveSystem) {
      const hasActiveWaves = this.shockwaveSystem.update(
        dtSeconds, 
        this.app.screen.width, 
        this.app.screen.height, 
        config
      );

      if (hasActiveWaves) {
        if (!this.masterContainer.filters || this.masterContainer.filters.length === 0) {
          this.masterContainer.filters = [this.shockwaveSystem.filter];
        }
      } else {
        this.masterContainer.filters = null;
      }
    }

    // Detect visual shakes to auto-fire WebGL ripples
    const glitchTriggered = isGlitchActive && config.glitchShakeIntensity > 15;
    if (glitchTriggered && !this.lastGlitchPeak && this.shockwaveSystem) {
      this.shockwaveSystem.trigger(
        this.headContainer.position,
        this.masterContainer.scale.x,
        this.app.screen.width,
        this.app.screen.height
      );
    }
    this.lastGlitchPeak = glitchTriggered;

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

    // --- Echoing Phase Trails Subsystem calculations ---
    if (this.trailSystem) {
      this.trailSystem.update(headState, config, isGlitchActive);
    }

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
        if (this.trailSystem?.destroy) {
          this.trailSystem.destroy();
          this.trailSystem = null;
        }
        if (this.shockwaveSystem?.destroy) {
          this.shockwaveSystem.destroy();
          this.shockwaveSystem = null;
        }
        if (this.searchlightSystem?.destroy) {
          this.searchlightSystem.destroy();
          this.searchlightSystem = null;
        }
        this.app.destroy(true, { children: true, texture: true }); 
      } catch (e) {
        console.warn("[PixiEngine] Strict cleanup warn:", e);
      }
    }
  }
}