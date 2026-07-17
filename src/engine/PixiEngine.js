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
import { getRenderResolution } from './renderResolution.js';

export class PixiEngine {
  /**
   * @param {HTMLDivElement} containerElement - Canvas wrapper element
   * @param {Object} storeInterface - Decoupled store methods
   * @param {Function} storeInterface.getState - State reader
   * @param {Function} storeInterface.subscribe - State change subscription handler
   */
  constructor(containerElement, storeInterface = {}) {
    this.container = containerElement;
    this.performanceStats = {
      samples: new Float32Array(120),
      sampleIndex: 0,
      sampleCount: 0,
      averageFrameMs: 0,
      slowFrames16: 0,
      slowFrames33: 0
    };
    
    // Assign fallback handlers to maintain stability when running without a store
    this.getState = storeInterface.getState || (() => ({}));
    this.subscribe = storeInterface.subscribe || (() => () => {});

    this.app = new Application();
    this.layers = {};
    this.time = 0;
    this.isReady = false;
    this.isDestroyed = false;
    this.hasUserGesture = false;
    this.residentRevealVisible = true;
    this.residentRevealAlpha = 1;
    this.residentRevealStartAlpha = 1;
    this.residentRevealElapsed = 0;
    this.residentRevealDuration = 0.35;
    this.residentRevealAnimating = false;
    this.residentHandoff = null;
    this.residentHandoffGeneration = 0;
    this.actorScreenPositionTarget = null;

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
    const reloadTriggerSelectors = [
      state => state.renderConfig?.actor.id,
      state => state.renderConfig?.scene.background.backdropId,
      state => state.renderConfig?.scene.background.patternStyle,
      state => state.renderConfig?.scene.background.mountainFrontId,
      state => state.renderConfig?.scene.background.mountainBackId
    ];

    reloadTriggerSelectors.forEach(selector => {
      this.unsubscribers.push(
        this.subscribe(
          selector,
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

  acknowledgeUserGesture() {
    this.hasUserGesture = true;
  }

  setResidentRevealVisible(visible, options = {}) {
    const nextVisible = visible !== false;
    const changed = nextVisible !== this.residentRevealVisible;
    this.residentRevealVisible = nextVisible;

    if (changed && nextVisible) {
      this.residentRevealStartAlpha = this.residentRevealAlpha;
      this.residentRevealElapsed = 0;
      this.residentRevealDuration = options.reducedMotion === true ? 0.16 : 0.35;
      this.residentRevealAnimating = this.residentRevealAlpha < 1;
    } else if (!nextVisible) {
      this.residentRevealAlpha = 0;
      this.residentRevealStartAlpha = 0;
      this.residentRevealElapsed = 0;
      this.residentRevealAnimating = false;
    }

    this.applyResidentRevealPresentation();
    this.updateActorScreenPositionPresentation();
  }

  applyResidentRevealPresentation() {
    const representedByAvatar = this.isResidentRepresentedByAvatar();
    const visible = this.residentRevealVisible && !representedByAvatar;
    if (this.actor?.container && !this.residentHandoff) {
      this.actor.container.visible = visible;
      this.actor.container.alpha = this.residentRevealAlpha;
    }
    if (this.trailSystem?.trailContainer) {
      this.trailSystem.trailContainer.visible = visible;
      this.trailSystem.trailContainer.alpha = this.residentRevealAlpha;
    }
    if (this.shedSkinTrailSystem?.container) {
      this.shedSkinTrailSystem.container.visible = visible;
      this.shedSkinTrailSystem.container.alpha = this.residentRevealAlpha;
    }
    if (this.searchlightSystem?.container) {
      if (!visible) this.searchlightSystem.container.visible = false;
      this.searchlightSystem.container.alpha = this.residentRevealAlpha;
    }
  }

  updateResidentReveal(deltaTime) {
    if (!this.residentRevealAnimating) return;
    this.residentRevealElapsed += Math.max(0, deltaTime) / 60;
    const progress = Math.min(1, this.residentRevealElapsed / this.residentRevealDuration);
    const easedProgress = 1 - ((1 - progress) * (1 - progress));
    this.residentRevealAlpha = this.residentRevealStartAlpha
      + (1 - this.residentRevealStartAlpha) * easedProgress;
    if (progress >= 1) {
      this.residentRevealAlpha = 1;
      this.residentRevealAnimating = false;
    }
    this.applyResidentRevealPresentation();
  }

  setActorScreenPositionTarget(target) {
    this.actorScreenPositionTarget = target || null;
    this.updateActorScreenPositionPresentation();
  }

  updateActorScreenPositionPresentation() {
    const target = this.actorScreenPositionTarget;
    if (!target) return;
    if (!this.masterContainer || !this.actor) {
      target.style.setProperty('--actor-void-radius', '0px');
      target.style.setProperty('--actor-void-falloff', '0px');
      return;
    }

    const actorGlobal = this.masterContainer.toGlobal(this.actor.container.position);
    target.style.setProperty('--actor-screen-x', `${actorGlobal.x.toFixed(1)}px`);
    target.style.setProperty('--actor-screen-y', `${actorGlobal.y.toFixed(1)}px`);
    const actorPresented = this.actor.container.visible && this.residentRevealAlpha > 0.05;
    target.style.setProperty('--actor-void-radius', actorPresented ? '104px' : '0px');
    target.style.setProperty('--actor-void-falloff', actorPresented ? '28px' : '0px');
  }

  getResidentBoundary(bounds, preferredEdge = null, referencePosition = null) {
    if (!this.masterContainer || !this.actor || !bounds) return null;
    const actorGlobal = this.masterContainer.toGlobal(referencePosition || this.actor.baselinePosition);
    const left = Number(bounds.left) || 0;
    const right = Number(bounds.right) || left;
    const top = Number(bounds.top) || 0;
    const bottom = Number(bounds.bottom) || top;
    const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
    const candidates = [
      { edge: 'top', x: clamp(actorGlobal.x, left, right), y: top },
      { edge: 'bottom', x: clamp(actorGlobal.x, left, right), y: bottom },
      { edge: 'left', x: left, y: clamp(actorGlobal.y, top, bottom) },
      { edge: 'right', x: right, y: clamp(actorGlobal.y, top, bottom) }
    ];
    candidates.sort((first, second) => (
      Math.hypot(first.x - actorGlobal.x, first.y - actorGlobal.y) -
      Math.hypot(second.x - actorGlobal.x, second.y - actorGlobal.y)
    ));
    const boundary = candidates.find((candidate) => candidate.edge === preferredEdge) || candidates[0];
    return {
      edge: boundary.edge,
      point: this.masterContainer.toLocal(boundary)
    };
  }

  startResidentHandoff(bounds, options = {}) {
    const generation = ++this.residentHandoffGeneration;
    const returnPosition = this.residentHandoff?.returnPosition || (this.actor
      ? { ...this.actor.baselinePosition }
      : null);
    const boundary = this.getResidentBoundary(bounds, null, returnPosition);
    this.residentHandoff = {
      generation,
      phase: 'approaching',
      bounds: { ...bounds },
      entryEdge: boundary?.edge || 'top',
      reducedMotion: options.reducedMotion === true,
      returnPosition,
      elapsed: 0,
      duration: options.reducedMotion === true ? 0.06 : 0.28,
      startAlpha: 1,
      onEntering: options.onEntering,
      onEntered: options.onEntered,
      onComplete: null
    };
    this.syncResidentHandoff();
    return this.residentHandoff.entryEdge;
  }

  updateResidentHandoffBounds(bounds) {
    if (!this.residentHandoff || !bounds) return null;
    this.residentHandoff.bounds = { ...bounds };
    const boundary = this.getResidentBoundary(bounds, null, this.residentHandoff.returnPosition);
    if (boundary) this.residentHandoff.entryEdge = boundary.edge;
    if (this.residentHandoff.phase === 'approaching') this.syncResidentHandoff();
    return this.residentHandoff.entryEdge;
  }

  syncResidentHandoff() {
    const handoff = this.residentHandoff;
    if (!handoff || !this.masterContainer || !this.actor) return;
    if (!handoff.returnPosition) handoff.returnPosition = { ...this.actor.baselinePosition };

    if (handoff.phase === 'open') {
      this.actor.container.alpha = 0;
      this.actor.container.visible = false;
      return;
    }
    if (handoff.phase !== 'approaching') return;

    const boundary = this.getResidentBoundary(handoff.bounds, handoff.entryEdge, handoff.returnPosition);
    if (!boundary) return;
    const boundaryPoint = boundary.point;
    this.actor.container.visible = true;
    this.actor.container.alpha = 1;
    if (handoff.reducedMotion) {
      this.actor.baselinePosition.x = boundaryPoint.x;
      this.actor.baselinePosition.y = boundaryPoint.y;
      this.actor.targetPosition.x = boundaryPoint.x;
      this.actor.targetPosition.y = boundaryPoint.y;
      this.actor.isMovingToTarget = false;
      handoff.phase = 'entering';
      handoff.onEntering?.();
    } else {
      this.actor.moveTo(boundaryPoint.x, boundaryPoint.y);
    }
  }

  exitResidentHandoff(bounds, options = {}) {
    const handoff = this.residentHandoff;
    if (!handoff || !this.actor || !this.masterContainer) {
      queueMicrotask(() => options.onComplete?.());
      return null;
    }

    ++this.residentHandoffGeneration;
    handoff.generation = this.residentHandoffGeneration;
    handoff.bounds = bounds ? { ...bounds } : handoff.bounds;
    handoff.onComplete = options.onComplete;
    handoff.reducedMotion = options.reducedMotion === true;

    if (handoff.phase === 'approaching' && this.actor.container.alpha >= 0.999) {
      const returnPosition = handoff.returnPosition;
      this.actor.container.visible = true;
      this.actor.container.alpha = 1;
      this.residentHandoff = null;
      if (returnPosition) this.actor.moveTo(returnPosition.x, returnPosition.y);
      queueMicrotask(() => options.onComplete?.());
      return handoff.entryEdge;
    }

    const boundary = this.getResidentBoundary(handoff.bounds, null, handoff.returnPosition);
    if (boundary) {
      handoff.entryEdge = boundary.edge;
      const boundaryPoint = boundary.point;
      this.actor.baselinePosition.x = boundaryPoint.x;
      this.actor.baselinePosition.y = boundaryPoint.y;
      this.actor.targetPosition.x = boundaryPoint.x;
      this.actor.targetPosition.y = boundaryPoint.y;
      this.actor.isMovingToTarget = false;
    }
    handoff.phase = 'exiting';
    handoff.elapsed = 0;
    handoff.duration = handoff.reducedMotion ? 0.06 : 0.28;
    handoff.startAlpha = Math.max(0, Math.min(1, this.actor.container.alpha || 0));
    this.actor.container.visible = true;
    return handoff.entryEdge;
  }

  finishResidentExit(handoff) {
    if (!this.actor || this.residentHandoff !== handoff) return;
    const returnPosition = handoff.returnPosition;
    const onComplete = handoff.onComplete;
    this.actor.container.visible = true;
    this.actor.container.alpha = 1;
    this.residentHandoff = null;
    if (returnPosition) this.actor.moveTo(returnPosition.x, returnPosition.y);
    onComplete?.();
  }

  cancelResidentHandoff() {
    const handoff = this.residentHandoff;
    this.residentHandoff = null;
    ++this.residentHandoffGeneration;
    if (!this.actor) return;
    this.actor.container.visible = true;
    this.actor.container.alpha = 1;
    if (handoff?.returnPosition) this.actor.moveTo(handoff.returnPosition.x, handoff.returnPosition.y);
  }

  updateResidentHandoff(deltaTime) {
    const handoff = this.residentHandoff;
    if (!handoff || !this.actor) return;

    if (handoff.phase === 'approaching' && !this.actor.isMovingToTarget) {
      handoff.phase = 'entering';
      handoff.elapsed = 0;
      handoff.onEntering?.();
    }

    if (handoff.phase === 'entering') {
      handoff.elapsed += Math.max(0, deltaTime) / 60;
      const progress = Math.min(1, handoff.elapsed / handoff.duration);
      this.actor.container.alpha = 1 - progress;
      if (progress >= 1) {
        this.actor.container.alpha = 0;
        this.actor.container.visible = false;
        handoff.phase = 'open';
        handoff.onEntered?.();
      }
      return;
    }

    if (handoff.phase === 'exiting') {
      handoff.elapsed += Math.max(0, deltaTime) / 60;
      const progress = Math.min(1, handoff.elapsed / handoff.duration);
      this.actor.container.alpha = handoff.startAlpha + (1 - handoff.startAlpha) * progress;
      if (progress >= 1) this.finishResidentExit(handoff);
    }
  }

  isResidentRepresentedByAvatar() {
    return this.residentHandoff?.phase === 'open';
  }

  async init() {
    try {
      await this.app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundAlpha: 1,
        backgroundColor: 0x050505,
        resolution: getRenderResolution(),
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
      this.app.ticker.add((ticker) => this.update(ticker.deltaTime, ticker.elapsedMS));
      this.resize();
      
      this.isReady = true;
      return true;
    } catch (err) {
      console.error("[PixiEngine] Init Error:", err);
      return false;
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
    this.syncResidentHandoff();
    this.shedSkinTrailSystem = new ShedSkinTrailSystem(this.masterContainer, this.app.renderer, this.actor, rig.keys.char_clipping_mask);
    this.setResidentRevealVisible(this.residentRevealVisible);

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
      this.syncResidentHandoff();
      this.shedSkinTrailSystem = new ShedSkinTrailSystem(this.masterContainer, this.app.renderer, this.actor, nextRig.keys.char_clipping_mask);
      this.setResidentRevealVisible(this.residentRevealVisible);
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

  update(deltaTime, elapsedMS = deltaTime * (1000 / 60)) {
    if (!this.isReady) return;
    if (import.meta.env.DEV) this.recordFramePerformance(elapsedMS);
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
        {
          isGlitchActive,
          glitchShakeIntensity,
          canvasHeight: this.canvasHeight,
          targetMovementMultiplier: this.residentHandoff?.phase === 'approaching' ? 4 : 1
        }
      );
      this.updateResidentReveal(deltaTime);
      this.updateResidentHandoff(deltaTime);
      const actorIsAvatar = this.isResidentRepresentedByAvatar();
      if (this.shedSkinTrailSystem?.container) this.shedSkinTrailSystem.container.visible = this.residentRevealVisible && !actorIsAvatar;
      if (this.residentRevealVisible && !actorIsAvatar) {
        this.shedSkinTrailSystem?.update(deltaTime, this.actor.headState, renderConfig.phenomena.shedSkin);
      }
    }
    this.updateActorScreenPositionPresentation();

    // 3. Update Volumetric Searchlight (Tracking mouse around active character)
    if (this.residentRevealVisible && this.searchlightSystem && this.actor && !this.isResidentRepresentedByAvatar()) {
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
    if (this.trailSystem?.trailContainer) {
      this.trailSystem.trailContainer.visible = this.residentRevealVisible && !this.isResidentRepresentedByAvatar();
    }
    if (this.residentRevealVisible && this.trailSystem && this.actor && !this.isResidentRepresentedByAvatar()) {
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
    this.syncResidentHandoff();
    this.updateActorScreenPositionPresentation();
  }

  destroy() {
    this.isDestroyed = true;
    this.actorScreenPositionTarget = null;

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

  recordFramePerformance(elapsedMS) {
    const stats = this.performanceStats;
    const frameMs = Number.isFinite(elapsedMS) ? elapsedMS : 0;
    stats.samples[stats.sampleIndex] = frameMs;
    stats.sampleIndex = (stats.sampleIndex + 1) % stats.samples.length;
    stats.sampleCount = Math.min(stats.sampleCount + 1, stats.samples.length);
    if (frameMs > 16.7) stats.slowFrames16 += 1;
    if (frameMs > 33.3) stats.slowFrames33 += 1;
    let total = 0;
    for (let index = 0; index < stats.sampleCount; index += 1) total += stats.samples[index];
    stats.averageFrameMs = stats.sampleCount > 0 ? total / stats.sampleCount : 0;
  }
}
