// src/engine/PixiEngine.js
import { 
  Application, 
  Assets, 
  Container, 
  Texture,
  Graphics
} from 'pixi.js';
import { EffectsSystem } from './systems/EffectsSystem.js';
import { RenderTextureManager } from './systems/RenderTextureManager.js';
import { AssetResolver } from './assets/AssetResolver.js';
import { ShockwaveSystem } from './systems/ShockwaveSystem.js';
import { TrailSystem } from './systems/TrailSystem.js';
import { SearchlightSystem } from './systems/SearchlightSystem.js';
import { ActorEntity } from './entities/ActorEntity.js';
import { StageEntity } from './entities/StageEntity.js';
import { ShedSkinTrailSystem } from './systems/ShedSkinTrailSystem.js';
import { DEFAULT_RENDER_CONFIG } from '../config/renderConfig.defaults.js';
import { resolveReactionFrame } from '../config/reactionProfiles.js';
import { getAssetReloadScope } from './stageAssetConfig.js';

export class PixiEngine {
  /**
   * @param {HTMLDivElement} containerElement - Canvas wrapper element
   * @param {Object} storeInterface - Decoupled store methods
   * @param {Function} storeInterface.getState - State reader
   * @param {Function} storeInterface.subscribe - State change subscription handler
   */
  constructor(containerElement, storeInterface = {}) {
    this.container = containerElement;
    
    // Assign fallback handlers to maintain stability when running without a store
    this.getState = storeInterface.getState || (() => ({}));
    this.subscribe = storeInterface.subscribe || (() => () => {});

    this.app = new Application();
    this.layers = {};
    this.time = 0;
    this.isReady = false;
    this.isDestroyed = false;

    // Load sequence counter to prevent overlapping asynchronous loading glitches
    this.loadSequence = 0;

    // Active modular entities
    this.actor = null;
    this.stage = null;
    
    // Unified container for loaded asset keys and metadata
    this.loadedRig = null; 

    // Systems Allocation
    this.effectsSystem = new EffectsSystem();
    this.renderTextureManager = null;
    
    // Track dynamic visible canvas height coordinate range
    this.canvasHeight = 1000; 
    
    // Subsystem Coordinators
    this.shockwaveSystem = null;
    this.trailSystem = null;
    this.searchlightSystem = null;
    this.shedSkinTrailSystem = null;

    this.lastGlitchPeak = false;
    this.currentLocalReaction = null;
    this.localReactionElapsed = 0.0;
    this.localReactionProgress = 0.0;

    // Double Mouse Tracker: Separate absolute screen-coords and normalized [-1, 1] scales
    this.absoluteMousePos = { x: 0, y: 0 };
    this.normalizedMousePos = { x: 0, y: 0 };
    this.hasMousePosition = false;

    // Set up a list to collect selector-based subscriptions
    this.unsubscribers = [];
    this.assetReloadScheduled = false;

    // Trigger explicit asset loading only when setup properties modify
    const reloadTriggerKeys = [
      'characterId',
      'bgClippingMaskId',
      'bgPatternStyle',
      'bgMountainId',
      'bgMountainBackId'
    ];

    reloadTriggerKeys.forEach(key => {
      this.unsubscribers.push(
        this.subscribe(
          state => state[key],
          () => this.scheduleAssetReload()
        )
      );
    });

    // Detect transaction trigger reactions using explicit selectors
    this.unsubscribers.push(
      this.subscribe(
        state => state.activeReaction,
        (nextReaction, prevReaction) => {
          const nextProgress = this.getState().reactionProgress;

          if (nextReaction !== null && (prevReaction !== nextReaction || nextProgress === 1.0)) {
            this.startLocalReaction(nextReaction);
          }
        }
      )
    );
  }

  /**
   * Tracks target coordinates relative to the screen dimensions.
   * @param {number} clientX - World horizontal position.
   * @param {number} clientY - World vertical position.
   */
  updateMousePos(clientX, clientY) {
    this.absoluteMousePos.x = clientX;
    this.absoluteMousePos.y = clientY;
    this.hasMousePosition = true;

    // Normalize coordinates to [-1, 1] range to avoid breaking pupil wander scripts
    this.normalizedMousePos.x = (clientX / window.innerWidth) * 2 - 1;
    this.normalizedMousePos.y = (clientY / window.innerHeight) * 2 - 1;
  }

  /**
   * Commands the active actor to float smoothly toward clicked coordinates.
   * @param {number} clientX - Absolute canvas click horizontal position.
   * @param {number} clientY - Absolute canvas click vertical position.
   */
  updateMouseClick(clientX, clientY) {
    if (!this.masterContainer || !this.actor) return;
    
    // Convert global screen pixel coordinates into master relative coordinates
    const localTarget = this.masterContainer.toLocal({ x: clientX, y: clientY });
    this.actor.moveTo(localTarget.x, localTarget.y);
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
      console.error("[PixiEngine] Init Error:", err);
    }
  }

  async loadAssets() {
    console.log(`%c🔍 [PixiEngine] Rig Loader: Locating Stage Assets`, 'color: #00f3ff; font-weight: bold;');
    
    // Resolve active asset configurations and store in a single property
    const renderConfig = this.getState().renderConfig ?? DEFAULT_RENDER_CONFIG;
    const results = await this.resolveConfiguredRig(renderConfig);
    this.loadedRig = results;

    if (results.verifiedLoadQueue.length > 0) {
      try {
        await Assets.load(results.verifiedLoadQueue);
        console.log("%c✅ [PixiEngine] Dynamic asset payload cached!", 'color: #00ff80; font-weight: bold;');
      } catch (err) {
        console.error("❌ [PixiEngine] Critical Loader Exception:", err);
      }
    }
  }

  scheduleAssetReload() {
    if (this.assetReloadScheduled || this.isDestroyed) return;
    this.assetReloadScheduled = true;
    queueMicrotask(() => {
      this.assetReloadScheduled = false;
      if (!this.isDestroyed) {
        this.reloadAssetsAndScene().catch((error) => console.error('Re-init assets failed:', error));
      }
    });
  }

  async resolveConfiguredRig(renderConfig) {
    return AssetResolver.resolveRig(renderConfig.actor.id, renderConfig.scene.background);
  }

  buildSceneGraph() {
    const { stage } = this.app;
    const rig = this.loadedRig;
    if (!rig) return;

    const renderConfig = this.getState().renderConfig ?? DEFAULT_RENDER_CONFIG;

    this.masterContainer = new Container();
    stage.addChild(this.masterContainer);

    let clipTex = Assets.get(rig.keys.char_clipping_mask);
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

    // Initialize Shockwave System
    this.shockwaveSystem = new ShockwaveSystem();

    // Initialize the off-screen RenderTextureManager to flatten warp patterns
    this.renderTextureManager = new RenderTextureManager({
      discoveredPatterns: rig.discoveredPatterns,
      bgPat1Alias: rig.hasBgPat1 ? rig.keys.bg_pat_1 : null,
      bgPat2Alias: rig.hasBgPat2 ? rig.keys.bg_pat_2 : null,
      hasBgPat1: rig.hasBgPat1,
      hasBgPat2: rig.hasBgPat2
    });

    // --- ENCAPSULATED STAGE CREATION ---
    const stageFlags = {
      isPanoramaMode: rig.isPanoramaMode,
      hasBg2: rig.hasBg2,
      bg2ParallaxSpeed: renderConfig.scene.background.parallaxSpeed,
      hasBgClippingMask: rig.hasBgClippingMask,
      hasBgPat1: rig.hasBgPat1,
      hasBgPat2: rig.hasBgPat2,
      hasBgMountainBack: rig.hasBgMountainBack,
      hasBgMountain: rig.hasBgMountain
    };
    this.stage = new StageEntity(
      renderConfig.scene.background.backdropId,
      rig.keys, 
      stageFlags, 
      this.bgHeightScale, 
      this.renderTextureManager, 
      this.app.renderer
    );
    this.bgAtmosphereContainer.addChild(this.stage.bgContainer);

    // Initialize Ghost Coordinates System
    this.trailSystem = new TrailSystem(this.masterContainer, rig.keys.char_clipping_mask);

    // Initialize Volumetric Searchlight System
    this.searchlightSystem = new SearchlightSystem(this.masterContainer);

    // --- ENCAPSULATED ACTOR CREATION ---
    const actorAssets = {
      char_clipping_mask: rig.hasCharClippingMask ? rig.keys.char_clipping_mask : null,
      char_lineart: rig.hasLineart ? rig.keys.char_lineart : null,
      char_base: rig.hasCharBase ? rig.keys.char_base : null,
      eyelids_top: rig.hasEyelids ? rig.keys.eyelids_top : null,
      eyelids_bottom: rig.hasEyelids ? rig.keys.eyelids_bottom : null,
      discoveredEyes: rig.discoveredEyes,
      discoveredPatterns: rig.discoveredPatterns
    };
    this.actor = new ActorEntity("active_character", actorAssets, this.renderTextureManager, this.app.renderer);
    this.masterContainer.addChild(this.actor.container);
    this.shedSkinTrailSystem = new ShedSkinTrailSystem(this.masterContainer, this.app.renderer, this.actor, rig.keys.char_clipping_mask);

    // Add stage foreground overlay container on top of the character
    this.masterContainer.addChild(this.stage.fgContainer);

    // Extract effect targets cleanly from both entities and attach lighting/shaders
    const stageTargets = this.stage.getEffectsTargets();
    const effectsTarget = this.actor.getEffectsTargets();
    
    this.effectsSystem.attach({
      headContainer: effectsTarget.headContainer,
      auraSprite: effectsTarget.auraSprite,
      baseSprite: effectsTarget.baseSprite,
      mountainReflector: stageTargets.mountainReflector,
      mountainBackReflector: stageTargets.mountainBackReflector,
      ceilingReflector: stageTargets.ceilingReflector
    });
  }

  async reloadAssetsAndScene() {
    const currentSeq = ++this.loadSequence;

    // Pre-resolve and load assets first, before destroying active display blocks
    const renderConfig = this.getState().renderConfig ?? DEFAULT_RENDER_CONFIG;
    const nextRig = await this.resolveConfiguredRig(renderConfig);

    if (this.isDestroyed || currentSeq !== this.loadSequence) return;

    if (nextRig.verifiedLoadQueue.length > 0) {
      try {
        await Assets.load(nextRig.verifiedLoadQueue);
      } catch (err) {
        console.error("❌ [PixiEngine] Preloading error:", err);
      }
    }

    if (this.isDestroyed || currentSeq !== this.loadSequence) return;

    this.isReady = false;

    const { actorChanged, backgroundPatternChanged, stageChanged } = getAssetReloadScope(this.loadedRig, nextRig);

    // Actor identity owns actor runtime state. Scene-only changes leave it untouched.
    if (actorChanged) {
      if (this.actor) {
        this.shedSkinTrailSystem?.destroy();
        this.shedSkinTrailSystem = null;
        if (this.actor.characterContentContainer) {
          this.actor.characterContentContainer.mask = null;
        }
        this.actor.destroy();
        this.actor = null;
      }
      if (this.trailSystem?.destroy) {
        this.trailSystem.destroy();
        this.trailSystem = null;
      }
      if (this.searchlightSystem?.destroy) {
        this.searchlightSystem.destroy();
        this.searchlightSystem = null;
      }
    }

    // Stage resources can be rebuilt independently of the actor render pass.
    if (stageChanged) {
      if (this.stage?.destroy) {
        this.stage.destroy();
        this.stage = null;
      }
    }

    this.loadedRig = nextRig;

    if (!this.masterContainer) {
      this.masterContainer = new Container();
      this.app.stage.addChild(this.masterContainer);
    }

    let clipTex = Assets.get(nextRig.keys.char_clipping_mask);
    if (!clipTex || clipTex === Texture.EMPTY) {
      clipTex = Assets.get('bg');
    }
    this.bgHeightScale = (clipTex && clipTex !== Texture.EMPTY) ? clipTex.height : 1000;

    if (actorChanged || !this.masterClipMask) {
      if (this.masterClipMask) this.masterClipMask.destroy();
      this.masterClipMask = new Graphics()
        .rect(-this.bgHeightScale / 2, -this.bgHeightScale / 2, this.bgHeightScale, this.bgHeightScale)
        .fill({ color: 0xffffff });
      this.masterContainer.addChild(this.masterClipMask);
      if (this.bgAtmosphereContainer) {
        this.bgAtmosphereContainer.mask = this.masterClipMask;
      }
    }

    if (!this.bgAtmosphereContainer) {
      this.bgAtmosphereContainer = new Container();
      this.bgAtmosphereContainer.mask = this.masterClipMask;
      this.masterContainer.addChild(this.bgAtmosphereContainer);
    }

    if (!this.shockwaveSystem) {
      this.shockwaveSystem = new ShockwaveSystem();
    }

    // Keep actor and background render passes independently replaceable.
    if (!this.renderTextureManager) {
      this.renderTextureManager = new RenderTextureManager({
        discoveredPatterns: nextRig.discoveredPatterns,
        bgPat1Alias: nextRig.hasBgPat1 ? nextRig.keys.bg_pat_1 : null,
        bgPat2Alias: nextRig.hasBgPat2 ? nextRig.keys.bg_pat_2 : null,
        hasBgPat1: nextRig.hasBgPat1,
        hasBgPat2: nextRig.hasBgPat2
      });
    } else if (actorChanged) {
      this.renderTextureManager.updateActorPatterns(nextRig.discoveredPatterns);
    }
    if (backgroundPatternChanged) {
      this.renderTextureManager.updateBackgroundPatterns({
        bgPat1Alias: nextRig.hasBgPat1 ? nextRig.keys.bg_pat_1 : null,
        bgPat2Alias: nextRig.hasBgPat2 ? nextRig.keys.bg_pat_2 : null,
        hasBgPat1: nextRig.hasBgPat1,
        hasBgPat2: nextRig.hasBgPat2
      });
    }

    // Rebuild stage layer templates if required
    if (stageChanged || !this.stage) {
      const stageFlags = {
        isPanoramaMode: nextRig.isPanoramaMode,
        hasBg2: nextRig.hasBg2,
        bg2ParallaxSpeed: renderConfig.scene.background.parallaxSpeed,
        hasBgClippingMask: nextRig.hasBgClippingMask,
        hasBgPat1: nextRig.hasBgPat1,
        hasBgPat2: nextRig.hasBgPat2,
        hasBgMountainBack: nextRig.hasBgMountainBack,
        hasBgMountain: nextRig.hasBgMountain
      };
      this.stage = new StageEntity(
        renderConfig.scene.background.backdropId,
        nextRig.keys, 
        stageFlags, 
        this.bgHeightScale, 
        this.renderTextureManager, 
        this.app.renderer
      );
      this.bgAtmosphereContainer.addChild(this.stage.bgContainer);
    }

    if (actorChanged) {
      this.trailSystem = new TrailSystem(this.masterContainer, nextRig.keys.char_clipping_mask);
      this.searchlightSystem = new SearchlightSystem(this.masterContainer);

      const actorAssets = {
        char_clipping_mask: nextRig.hasCharClippingMask ? nextRig.keys.char_clipping_mask : null,
        char_lineart: nextRig.hasLineart ? nextRig.keys.char_lineart : null,
        char_base: nextRig.hasCharBase ? nextRig.keys.char_base : null,
        eyelids_top: nextRig.hasEyelids ? nextRig.keys.eyelids_top : null,
        eyelids_bottom: nextRig.hasEyelids ? nextRig.keys.eyelids_bottom : null,
        discoveredEyes: nextRig.discoveredEyes,
        discoveredPatterns: nextRig.discoveredPatterns
      };
      this.actor = new ActorEntity("active_character", actorAssets, this.renderTextureManager, this.app.renderer);
      this.masterContainer.addChild(this.actor.container);
      this.shedSkinTrailSystem = new ShedSkinTrailSystem(this.masterContainer, this.app.renderer, this.actor, nextRig.keys.char_clipping_mask);
    }

    if (this.stage.fgContainer.parent) {
      this.stage.fgContainer.parent.removeChild(this.stage.fgContainer);
    }
    this.masterContainer.addChild(this.stage.fgContainer);

    const stageTargets = this.stage.getEffectsTargets();
    const stageEffectTargets = {
      mountainReflector: stageTargets.mountainReflector,
      mountainBackReflector: stageTargets.mountainBackReflector,
      ceilingReflector: stageTargets.ceilingReflector
    };
    if (actorChanged) {
      const effectsTarget = this.actor.getEffectsTargets();
      this.effectsSystem.attach({
        headContainer: effectsTarget.headContainer,
        auraSprite: effectsTarget.auraSprite,
        baseSprite: effectsTarget.baseSprite,
        ...stageEffectTargets
      });
    } else {
      this.effectsSystem.attach(stageEffectTargets);
    }

    this.resize();
    this.isReady = true;
  }

  /**
   * Assigns local animation preferences to transition visually during triggered reactions.
   */
  startLocalReaction(reactionType) {
    const renderConfig = this.getState().renderConfig ?? DEFAULT_RENDER_CONFIG;
    const reaction = resolveReactionFrame(renderConfig, reactionType, 0);
    if (!reaction.active) {
      const setParameter = this.getState().setParameter;
      if (typeof setParameter === 'function') {
        setParameter('activeReaction', null);
        setParameter('reactionProgress', 0.0);
      }
      return;
    }

    this.currentLocalReaction = reactionType;
    this.localReactionElapsed = 0.0;
    this.localReactionProgress = 1.0;

    // Direct WebGL ripples trigger centered on active character position
    if (reaction.modifiers.shockwave?.enabled && this.shockwaveSystem && this.actor) {
      this.shockwaveSystem.trigger(
        this.actor.container.position,
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
    const liveStore = this.getState();
    const renderConfig = liveStore.renderConfig ?? DEFAULT_RENDER_CONFIG;
    let resolvedReaction = resolveReactionFrame(renderConfig, null, 0);

    // Decay the dynamic reaction progression metrics
    if (this.currentLocalReaction) {
      this.localReactionElapsed += dtSeconds;
      resolvedReaction = resolveReactionFrame(renderConfig, this.currentLocalReaction, this.localReactionElapsed);
      this.localReactionProgress = resolvedReaction.progress;

      if (resolvedReaction.complete) {
        this.localReactionProgress = 0;
        this.localReactionElapsed = 0;
        this.currentLocalReaction = null;
        resolvedReaction = resolveReactionFrame(renderConfig, null, 0);

        // Broadcast final boundary progress cleanly via native CustomEvent before resetting store
        window.dispatchEvent(new CustomEvent('gothic-reaction-progress', { detail: { progress: 0.0 } }));

        // Reset the store values once when the decay concludes using decoupled state setter
        const setParameter = this.getState().setParameter;
        if (typeof setParameter === 'function') {
          setParameter("activeReaction", null);
          setParameter("reactionProgress", 0.0);
        }
      } else {
        // Dispatch custom event to avoid triggering high-frequency React state updates
        window.dispatchEvent(new CustomEvent('gothic-reaction-progress', { detail: { progress: this.localReactionProgress } }));
      }
    }

    // Persistent authored values come only from RenderConfig. Animation state stays local.
    const runtime = {
      elapsed: this.time,
      reaction: resolvedReaction,
      pointer: {
        normalized: this.normalizedMousePos,
        absolute: this.absoluteMousePos,
        available: this.hasMousePosition
      }
    };
    const actorConfig = renderConfig.actor;
    const effectsConfig = renderConfig.effects;

    const { isGlitched, currentSplit } = this.effectsSystem.update(
      actorConfig.aura,
      {
        chromaticAberration: effectsConfig.chromaticAberration,
        flicker: effectsConfig.flicker
      },
      { elapsed: runtime.elapsed, reactionModifiers: runtime.reaction.modifiers }
    );

    // Glitch status and shake factor calculated cleanly relative to active parameters
    const glitchShakeIntensity = runtime.reaction.modifiers.screenShake?.intensity
      ?? effectsConfig.glitch.screenShakeIntensity;

    const isGlitchActive = (isGlitched || currentSplit > (effectsConfig.chromaticAberration.amount * 1.15));
    
    // 1. Update Environment Stage (parallax backgrounds, fogs, particles)
    if (this.stage) {
      this.stage.update(deltaTime, renderConfig.scene, actorConfig.aura.color, {
        elapsed: runtime.elapsed,
        reactionModifiers: runtime.reaction.modifiers
      });
    }

    // 2. Update Actor Entity
    if (this.actor) {
      this.actor.update(
        deltaTime,
        actorConfig,
        renderConfig.phenomena,
        {
          elapsed: runtime.elapsed,
          pointer: runtime.pointer,
          reactionModifiers: runtime.reaction.modifiers
        },
        { isGlitchActive, glitchShakeIntensity, canvasHeight: this.canvasHeight }
      );
      this.shedSkinTrailSystem?.update(deltaTime, this.actor.headState, renderConfig.phenomena.shedSkin);
    }

    // 3. Update Volumetric Searchlight (Tracking mouse around active character)
    if (this.searchlightSystem && this.actor) {
      this.searchlightSystem.update(this.actor.container.position, runtime.pointer.absolute, actorConfig.searchlight);
    }

    // 4. WebGL Portal Refraction Ripple Subsystem updates
    if (this.shockwaveSystem && this.actor) {
      const hasActiveWaves = this.shockwaveSystem.update(
        dtSeconds, 
        this.app.screen.width, 
        this.app.screen.height, 
        effectsConfig.shockwave
      );

      if (hasActiveWaves) {
        if (!this.masterContainer.filters || this.masterContainer.filters.length === 0) {
          this.masterContainer.filters = [this.shockwaveSystem.filter];
        }
      } else {
        this.masterContainer.filters = null;
      }
    }

    // Detect visual shakes to auto-fire WebGL ripples on active character position
    const glitchTriggered = isGlitchActive && glitchShakeIntensity > 15;
    if (glitchTriggered && !this.lastGlitchPeak && this.shockwaveSystem && this.actor) {
      this.shockwaveSystem.trigger(
        this.actor.container.position,
        this.masterContainer.scale.x,
        this.app.screen.width,
        this.app.screen.height
      );
    }
    this.lastGlitchPeak = glitchTriggered;

    // Update off-screen RenderTextureManager pass for warp filters
    if (this.renderTextureManager) {
      this.renderTextureManager.update(
        deltaTime,
        actorConfig.warp,
        renderConfig.scene.background,
        this.app.renderer,
        this.actor?.warpPointer || null,
        runtime.reaction.modifiers
      );
    }

    // --- Echoing Phase Trails Subsystem calculations (Reading active actor state) ---
    if (this.trailSystem && this.actor) {
      this.trailSystem.update(this.actor.getTrailRenderTransformSnapshot(), effectsConfig.spectralTrail, {
        isGlitchActive,
        screenShakeIntensity: glitchShakeIntensity,
        reactionModifiers: runtime.reaction.modifiers
      });
    }
  }

  resize() {
    if(!this.app || !this.app.renderer || !this.masterContainer) return;
    this.app.renderer.resize(window.innerWidth, window.innerHeight);
    const { screen } = this.app;
    
    // 1. Center the camera container on screen
    this.masterContainer.position.set(screen.width / 2, screen.height / 2);
    
    // 2. Define a stable logical height baseline for side-scrollers.
    const logicalHeight = 1200; 
    
    // 3. Proportional height scaling: scale depends only on the screen's height
    const scale = screen.height / logicalHeight;
    this.masterContainer.scale.set(scale);

    // 4. Calculate the resulting visible local bounds
    const localW = screen.width / scale;
    const localH = screen.height / scale;
    
    // Save the actual coordinate viewport height inside the engine loop
    this.canvasHeight = localH;

    if (this.masterClipMask) {
      this.masterClipMask.clear()
        .rect(-localW / 2, -localH / 2, localW, localH)
        .fill({ color: 0xffffff });
    }

    // Propagate the new visible layout bounds to the stage layers to prevent edge-cutoffs
    if (this.stage && typeof this.stage.resize === 'function') {
      this.stage.resize(localW, localH);
    }
  }

  destroy() {
    this.isDestroyed = true;

    if (this.unsubscribers) {
      this.unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      this.unsubscribers = [];
    }

    if (this.isReady && this.app) {
      try { 
        if (this.actor) {
          this.shedSkinTrailSystem?.destroy();
          this.shedSkinTrailSystem = null;
          if (this.actor.characterContentContainer) {
            this.actor.characterContentContainer.mask = null;
          }
          this.actor.destroy();
          this.actor = null;
        }
        if (this.stage?.destroy) {
          this.stage.destroy();
          this.stage = null;
        }

        if (this.renderTextureManager?.destroy) {
          this.renderTextureManager.destroy();
          this.renderTextureManager = null;
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

        // Only release textures from cache when the app is completely unmounted/unloaded
        if (this.loadedRig && this.loadedRig.verifiedLoadQueue && this.loadedRig.verifiedLoadQueue.length > 0) {
          Assets.unload(this.loadedRig.verifiedLoadQueue).catch(() => {});
          this.loadedRig = null;
        }

        this.app.destroy(true, { children: true, texture: true }); 
      } catch (e) {
        console.warn("[PixiEngine] Strict cleanup warn:", e);
      }
    }
  }
}
