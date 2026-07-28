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
import { developmentLog, reportControlledError } from '../diagnostics.js';

const DEV_DIAGNOSTICS = typeof __DEVELOPMENT_DIAGNOSTICS__ !== 'undefined' && __DEVELOPMENT_DIAGNOSTICS__ === true;

export class PixiEngine {
  /**
   * @param {HTMLDivElement} containerElement - Canvas wrapper element
   * @param {Object} storeInterface - Decoupled store methods
   * @param {Function} storeInterface.getState - State reader
   * @param {Function} storeInterface.subscribe - State change subscription handler
   * @param {Object} dependencies - Optional lifecycle test dependencies
   * @param {Application} dependencies.application - Injected Pixi application
   */
  constructor(containerElement, storeInterface = {}, dependencies = {}) {
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

    // The injected application is a deliberately small lifecycle-test seam.
    this.app = dependencies.application || new Application();
    this.appInitialized = false;
    this.appDestroyed = false;
    this.layers = {};
    this.time = 0;
    this.isReady = false;
    this.isDestroyed = false;
    this.isInitializing = false;
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
    this.assetReloadRequested = false;
    this.assetReloadInFlight = false;

    // Trigger explicit asset loading only when setup properties modify
    const reloadTriggerSelectors = [
      state => state.renderConfig?.actor.id,
      state => state.renderConfig?.scene.environment.type,
      state => state.renderConfig?.scene.environment.shaderId,
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
    if (this.residentHandoff && localTarget.x !== this.actor.baselinePosition.x) {
      this.residentHandoff.residentFacing = localTarget.x > this.actor.baselinePosition.x ? 1 : -1;
    }
    this.actor.moveTo(localTarget.x, localTarget.y);
  }

  /**
   * Moves the actor horizontally in screen space without changing its current
   * presented height. Spatial worlds use this while their camera pans so a
   * horizontal navigation gesture cannot pull the resident toward a horizon.
   * @param {number} clientX - Absolute canvas horizontal position.
   * @param {number} direction - Intended spatial travel direction.
   */
  updateHorizontalMove(clientX, direction = 0) {
    if (!this.masterContainer || !this.actor) return;
    const actorGlobal = this.masterContainer.toGlobal(this.actor.container.position);
    const baselineGlobal = this.masterContainer.toGlobal(this.actor.baselinePosition);
    const intendedDirection = direction === -1 || direction === 1 ? direction : 0;
    const distanceInDirection = intendedDirection
      ? (clientX - baselineGlobal.x) * intendedDirection
      : 0;
    const directedAdvance = intendedDirection
      ? Math.min(72, Math.max(24, distanceInDirection))
      : 0;
    const directedClientX = intendedDirection
      ? baselineGlobal.x + intendedDirection * directedAdvance
      : clientX;
    const localTarget = this.masterContainer.toLocal({ x: directedClientX, y: actorGlobal.y });
    if (this.residentHandoff && intendedDirection) {
      this.residentHandoff.residentFacing = intendedDirection;
    }
    // Keep the already-authored local Y target verbatim. Repeated global/local
    // round-trips accumulate transform drift while the actor is animating.
    this.actor.moveTo(localTarget.x, this.actor.targetPosition.y);
  }

  acknowledgeUserGesture() {
    this.hasUserGesture = true;
  }

  getKeeperReactionAvailability() {
    return {
      ready: this.isReady === true,
      residentHandoff: Boolean(this.residentHandoff),
      actorMoving: Boolean(this.actor?.isMovingToTarget)
    };
  }

  triggerKeeperReaction(reactionType) {
    const availability = this.getKeeperReactionAvailability();
    if (!availability.ready || availability.residentHandoff || availability.actorMoving) return false;
    this.startLocalReaction(reactionType);
    return true;
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

  setStageVisible(visible) {
    this.stagePresentationVisible = visible !== false;
    if (this.stage?.bgContainer) this.stage.bgContainer.visible = this.stagePresentationVisible;
    if (this.stage?.fgContainer) this.stage.fgContainer.visible = this.stagePresentationVisible;
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
    const targets = (Array.isArray(this.actorScreenPositionTarget)
      ? this.actorScreenPositionTarget
      : [this.actorScreenPositionTarget]).filter(Boolean);
    if (!targets.length) return;
    if (!this.masterContainer || !this.actor) {
      targets.forEach((target) => {
        target.style.setProperty('--actor-void-radius', '0px');
        target.style.setProperty('--actor-void-falloff', '0px');
      });
      return;
    }

    const actorGlobal = this.masterContainer.toGlobal(this.actor.container.position);
    const actorPresented = this.actor.container.visible && this.residentRevealAlpha > 0.05;
    targets.forEach((target) => {
      target.style.setProperty('--actor-screen-x', `${actorGlobal.x.toFixed(1)}px`);
      target.style.setProperty('--actor-screen-y', `${actorGlobal.y.toFixed(1)}px`);
      target.style.setProperty('--actor-void-radius', actorPresented ? '104px' : '0px');
      target.style.setProperty('--actor-void-falloff', actorPresented ? '28px' : '0px');
    });
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

  snapshotResidentBounds(bounds) {
    if (!bounds) return null;
    const left = Number(bounds.left) || 0;
    const top = Number(bounds.top) || 0;
    const width = Math.max(0, Number(bounds.width) || ((Number(bounds.right) || left) - left));
    const height = Math.max(0, Number(bounds.height) || ((Number(bounds.bottom) || top) - top));
    return {
      left,
      top,
      right: Number.isFinite(Number(bounds.right)) ? Number(bounds.right) : left + width,
      bottom: Number.isFinite(Number(bounds.bottom)) ? Number(bounds.bottom) : top + height,
      width,
      height
    };
  }

  getResidentHandoffTarget(bounds, targetMode = 'boundary', preferredEdge = null, referencePosition = null) {
    if (!this.masterContainer || !bounds) return null;
    if (targetMode === 'center') {
      const left = Number(bounds.left) || 0;
      const right = Number(bounds.right) || left;
      const top = Number(bounds.top) || 0;
      const bottom = Number(bounds.bottom) || top;
      return {
        edge: 'center',
        point: this.masterContainer.toLocal({ x: (left + right) / 2, y: (top + bottom) / 2 })
      };
    }
    return this.getResidentBoundary(bounds, preferredEdge, referencePosition);
  }

  startResidentHandoff(bounds, options = {}) {
    const generation = ++this.residentHandoffGeneration;
    const returnPosition = this.residentHandoff?.returnPosition || (this.actor
      ? { ...this.actor.baselinePosition }
      : null);
    const targetMode = options.targetMode === 'center' ? 'center' : 'boundary';
    const handoffBounds = this.snapshotResidentBounds(bounds);
    const boundary = this.getResidentHandoffTarget(handoffBounds, targetMode, null, returnPosition);
    const approachDistance = boundary && this.actor
      ? Math.hypot(
        boundary.point.x - this.actor.baselinePosition.x,
        boundary.point.y - this.actor.baselinePosition.y
      )
      : 0;
    this.residentHandoff = {
      generation,
      phase: 'approaching',
      bounds: handoffBounds,
      entryEdge: boundary?.edge || 'top',
      targetMode,
      keepVisible: options.keepVisible === true,
      residentScale: Math.max(0.2, Math.min(1, Number(options.residentScale) || 1)),
      residentFacing: options.residentFacing === -1 ? -1 : options.residentFacing === 1 ? 1 : null,
      scaleMultiplier: 1,
      approachDistance,
      reducedMotion: options.reducedMotion === true,
      returnPosition,
      elapsed: 0,
      duration: options.reducedMotion === true
        ? 0.06
        : Math.max(0.18, Math.min(1.2, Number(options.duration) || 0.28)),
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
    this.residentHandoff.bounds = this.snapshotResidentBounds(bounds);
    const boundary = this.getResidentHandoffTarget(
      this.residentHandoff.bounds,
      this.residentHandoff.targetMode,
      null,
      this.residentHandoff.returnPosition
    );
    if (boundary) this.residentHandoff.entryEdge = boundary.edge;
    if (this.residentHandoff.phase === 'approaching') this.syncResidentHandoff();
    return this.residentHandoff.entryEdge;
  }

  syncResidentHandoff() {
    const handoff = this.residentHandoff;
    if (!handoff || !this.masterContainer || !this.actor) return;
    if (!handoff.returnPosition) handoff.returnPosition = { ...this.actor.baselinePosition };

    if (handoff.phase === 'open') {
      this.actor.container.alpha = handoff.keepVisible ? 1 : 0;
      this.actor.container.visible = handoff.keepVisible;
      return;
    }
    if (handoff.phase !== 'approaching') return;

    const boundary = this.getResidentHandoffTarget(
      handoff.bounds,
      handoff.targetMode,
      handoff.entryEdge,
      handoff.returnPosition
    );
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
      if (handoff.keepVisible) {
        handoff.phase = 'open';
        handoff.scaleMultiplier = handoff.residentScale;
        this.resetResidentTravelEffects();
        handoff.onEntering?.();
        handoff.onEntered?.();
      } else {
        handoff.phase = 'entering';
        handoff.onEntering?.();
      }
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
    if (handoff.phase === 'exiting') return handoff.entryEdge;

    ++this.residentHandoffGeneration;
    handoff.generation = this.residentHandoffGeneration;
    handoff.bounds = bounds ? this.snapshotResidentBounds(bounds) : handoff.bounds;
    handoff.onComplete = options.onComplete;
    handoff.reducedMotion = options.reducedMotion === true;

    const boundary = this.getResidentHandoffTarget(
      handoff.bounds,
      handoff.targetMode,
      null,
      handoff.returnPosition
    );
    if (boundary && !handoff.keepVisible) {
      handoff.entryEdge = boundary.edge;
      const boundaryPoint = boundary.point;
      this.actor.baselinePosition.x = boundaryPoint.x;
      this.actor.baselinePosition.y = boundaryPoint.y;
      this.actor.targetPosition.x = boundaryPoint.x;
      this.actor.targetPosition.y = boundaryPoint.y;
      this.actor.isMovingToTarget = false;
    }
    handoff.exitStartScale = handoff.keepVisible
      ? Math.max(handoff.residentScale, Math.min(1, handoff.scaleMultiplier ?? handoff.residentScale))
      : 1;
    handoff.exitPosition = options.screenTarget &&
      Number.isFinite(options.screenTarget.clientX) &&
      Number.isFinite(options.screenTarget.clientY)
      ? this.masterContainer.toLocal({
        x: options.screenTarget.clientX,
        y: options.screenTarget.clientY
      })
      : handoff.returnPosition;
    handoff.phase = 'exiting';
    handoff.elapsed = 0;
    handoff.duration = handoff.reducedMotion
      ? 0.06
      : Math.max(0.18, Math.min(1.2, Number(options.duration) || 0.28));
    handoff.startAlpha = Math.max(0, Math.min(1, this.actor.container.alpha || 0));
    this.actor.container.visible = true;
    this.resetResidentTravelEffects();
    if (this.trailSystem?.trailContainer) {
      this.trailSystem.trailContainer.visible = this.residentRevealVisible;
    }
    if (this.shedSkinTrailSystem?.container) {
      this.shedSkinTrailSystem.container.visible = this.residentRevealVisible;
    }
    if (handoff.keepVisible && handoff.exitPosition) {
      handoff.exitDistance = Math.hypot(
        handoff.exitPosition.x - this.actor.baselinePosition.x,
        handoff.exitPosition.y - this.actor.baselinePosition.y
      );
      if (handoff.reducedMotion || handoff.exitDistance <= 0.001) {
        this.actor.baselinePosition.x = handoff.exitPosition.x;
        this.actor.baselinePosition.y = handoff.exitPosition.y;
        this.actor.targetPosition.x = handoff.exitPosition.x;
        this.actor.targetPosition.y = handoff.exitPosition.y;
        this.actor.isMovingToTarget = false;
        this.finishResidentExit(handoff);
      } else {
        this.actor.moveTo(handoff.exitPosition.x, handoff.exitPosition.y);
      }
    } else if (handoff.keepVisible) {
      this.finishResidentExit(handoff);
    }
    return handoff.entryEdge;
  }

  finishResidentExit(handoff) {
    if (!this.actor || this.residentHandoff !== handoff) return;
    const onComplete = handoff.onComplete;
    handoff.onComplete = null;
    this.actor.container.visible = true;
    this.actor.container.alpha = 1;
    this.actor.container.scale.set(
      this.actor.headState.scale * this.actor.baseActorScale,
      this.actor.headState.scale * this.actor.baseActorScale
    );
    this.residentHandoff = null;
    onComplete?.();
  }

  resetResidentTravelEffects() {
    this.trailSystem?.reset?.();
    this.shedSkinTrailSystem?.reset?.(this.actor?.headState);
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

    if (handoff.phase === 'approaching' && handoff.keepVisible) {
      const progress = this.getResidentTravelProgress(handoff.approachDistance, this.actor.targetPosition);
      const easedProgress = progress * progress * (3 - (2 * progress));
      const scale = 1 - ((1 - handoff.residentScale) * easedProgress);
      handoff.scaleMultiplier = scale;
      this.actor.container.scale.set(this.actor.container.scale.x * scale, this.actor.container.scale.y * scale);
      if (!this.actor.isMovingToTarget) {
        handoff.phase = 'open';
        handoff.scaleMultiplier = handoff.residentScale;
        this.resetResidentTravelEffects();
        handoff.onEntering?.();
        handoff.onEntered?.();
      }
      return;
    }

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

    if (handoff.phase === 'open' && handoff.keepVisible) {
      this.actor.container.visible = true;
      this.actor.container.alpha = 1;
      this.actor.container.scale.set(
        this.actor.container.scale.x * handoff.residentScale,
        this.actor.container.scale.y * handoff.residentScale
      );
      handoff.scaleMultiplier = handoff.residentScale;
      return;
    }

    if (handoff.phase === 'exiting') {
      if (handoff.keepVisible) {
        const progress = this.getResidentTravelProgress(handoff.exitDistance, handoff.exitPosition);
        const easedProgress = progress * progress * (3 - (2 * progress));
        const scale = handoff.exitStartScale + ((1 - handoff.exitStartScale) * easedProgress);
        handoff.scaleMultiplier = scale;
        this.actor.container.alpha = 1;
        this.actor.container.scale.set(this.actor.container.scale.x * scale, this.actor.container.scale.y * scale);
        if (!this.actor.isMovingToTarget) this.finishResidentExit(handoff);
        return;
      }
      handoff.elapsed += Math.max(0, deltaTime) / 60;
      const progress = Math.min(1, handoff.elapsed / handoff.duration);
      this.actor.container.alpha = handoff.startAlpha + (1 - handoff.startAlpha) * progress;
      if (progress >= 1) this.finishResidentExit(handoff);
    }
  }

  isResidentRepresentedByAvatar() {
    return this.residentHandoff?.phase === 'entering' || this.residentHandoff?.phase === 'open';
  }

  getResidentTravelProgress(totalDistance, targetPosition) {
    if (!this.actor || !targetPosition || !Number.isFinite(totalDistance) || totalDistance <= 0.001) return 1;
    const remainingDistance = Math.hypot(
      targetPosition.x - this.actor.baselinePosition.x,
      targetPosition.y - this.actor.baselinePosition.y
    );
    return Math.min(1, Math.max(0, 1 - (remainingDistance / totalDistance)));
  }

  getResidentHandoffDynamics() {
    const handoff = this.residentHandoff;
    if (!handoff?.keepVisible) {
      return { motionScale: 1, facing: null, facingResponse: 0.2 };
    }
    if (handoff.phase === 'approaching') {
      const progress = this.getResidentTravelProgress(handoff.approachDistance, this.actor?.targetPosition);
      const easedProgress = progress * progress * (3 - (2 * progress));
      return {
        motionScale: 1 - (0.92 * easedProgress),
        facing: null,
        facingResponse: 0.2
      };
    }
    if (handoff.phase === 'open') {
      return { motionScale: 0.08, facing: handoff.residentFacing, facingResponse: 0.065 };
    }
    const progress = Math.min(1, Math.max(0, handoff.elapsed / Math.max(0.001, handoff.duration)));
    const easedProgress = progress * progress * (3 - (2 * progress));
    if (handoff.phase === 'entering') {
      return {
        motionScale: 1 - (0.92 * easedProgress),
        facing: progress >= 0.42 ? handoff.residentFacing : null,
        facingResponse: 0.05
      };
    }
    if (handoff.phase === 'exiting') {
      const travelProgress = this.getResidentTravelProgress(handoff.exitDistance, handoff.exitPosition);
      const easedTravelProgress = travelProgress * travelProgress * (3 - (2 * travelProgress));
      return {
        motionScale: 0.08 + (0.92 * easedTravelProgress),
        facing: null,
        facingResponse: 0.12
      };
    }
    return { motionScale: 1, facing: null, facingResponse: 0.2 };
  }

  async init() {
    if (this.isDestroyed || this.isInitializing || this.isReady) return false;
    this.isInitializing = true;
    try {
      await this.app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        // The host element supplies the normal black backing. Keeping the renderer
        // transparent lets gallery architecture sit behind the resident canvas.
        backgroundAlpha: 0,
        // Transparent pixels must clear to true black. A non-black RGB clear can
        // leak through browser WebGL compositing even when its alpha is zero.
        backgroundColor: 0x000000,
        resolution: getRenderResolution(),
        autoDensity: true,
        preference: 'webgl', 
      });
      this.appInitialized = true;

      if (this.isDestroyed) {
        this.destroyApplication();
        return false;
      }

      this.container.appendChild(this.app.canvas);

      // Configuration changes during a load request another serial pass. The
      // scene is installed only after the latest store state has been loaded.
      do {
        this.assetReloadRequested = false;
        const currentSeq = ++this.loadSequence;
        await this.loadAssets(currentSeq);
        if (this.isDestroyed || currentSeq !== this.loadSequence) return false;
      } while (this.assetReloadRequested);
      
      this.buildSceneGraph();
      if (this.isDestroyed) return false;
      this.app.ticker.add((ticker) => this.update(ticker.deltaTime, ticker.elapsedMS));
      this.resize();
      
      this.isReady = true;
      return true;
    } catch (err) {
      if (!this.isDestroyed) {
        reportControlledError('pixi-init', err);
        this.destroyApplication();
      }
      return false;
    } finally {
      this.isInitializing = false;
      if (this.isDestroyed) this.destroyApplication();
      else if (this.assetReloadRequested && this.isReady) this.scheduleAssetReload();
    }
  }

  async loadAssets(sequence = this.loadSequence) {
    if (DEV_DIAGNOSTICS) developmentLog('[pixi-assets] resolving rig');
    
    // Resolve active asset configurations and store in a single property
    const renderConfig = this.getState().renderConfig ?? DEFAULT_RENDER_CONFIG;
    const results = await this.resolveConfiguredRig(renderConfig);
    if (this.isDestroyed || sequence !== this.loadSequence) return false;

    if (results.verifiedLoadQueue.length > 0) {
      try {
        await Assets.load(results.verifiedLoadQueue);
        if (DEV_DIAGNOSTICS) developmentLog('[pixi-assets] payload cached');
      } catch (err) {
        reportControlledError('pixi-asset-load', err);
      }
    }
    if (this.isDestroyed || sequence !== this.loadSequence) {
      if (results.verifiedLoadQueue.length > 0) Assets.unload(results.verifiedLoadQueue).catch(() => {});
      return false;
    }
    this.loadedRig = results;
    return true;
  }

  scheduleAssetReload() {
    if (this.isDestroyed) return;
    this.assetReloadRequested = true;
    if (this.isInitializing || this.assetReloadInFlight || !this.isReady || this.assetReloadScheduled) return;
    this.assetReloadScheduled = true;
    queueMicrotask(() => {
      this.assetReloadScheduled = false;
      this.drainAssetReloads().catch((error) => reportControlledError('pixi-asset-reload', error));
    });
  }

  async drainAssetReloads() {
    if (this.isDestroyed || this.isInitializing || this.assetReloadInFlight || !this.isReady) return;
    this.assetReloadInFlight = true;
    try {
      while (this.assetReloadRequested && !this.isDestroyed) {
        this.assetReloadRequested = false;
        await this.reloadAssetsAndScene();
      }
    } finally {
      this.assetReloadInFlight = false;
      if (this.assetReloadRequested && this.isReady && !this.isDestroyed) this.scheduleAssetReload();
    }
  }

  async resolveConfiguredRig(renderConfig) {
    return AssetResolver.resolveRig(renderConfig.actor.id, renderConfig.scene.background, renderConfig.scene.environment);
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
      this.app.renderer,
      renderConfig.scene
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
    this.setStageVisible(this.stagePresentationVisible !== false);

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
        reportControlledError('pixi-asset-preload', err);
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
        this.app.renderer,
        renderConfig.scene
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
    this.setStageVisible(this.stagePresentationVisible !== false);

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
        actorPosition: this.actor ? {
          x: this.actor.container.position.x,
          y: this.actor.container.position.y
        } : null,
        actorAvailable: Boolean(this.actor?.container?.visible && this.residentRevealVisible && !this.isResidentRepresentedByAvatar()),
        reactionModifiers: runtime.reaction.modifiers
      });
    }

    // 2. Update Actor Entity
    if (this.actor) {
      const residentDynamics = this.getResidentHandoffDynamics();
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
          targetMovementMultiplier: this.residentHandoff?.phase === 'approaching' ? 2.2 : 1,
          residentMotionScale: residentDynamics.motionScale,
          residentFacing: residentDynamics.facing,
          facingResponse: residentDynamics.facingResponse
        }
      );
      this.updateResidentReveal(deltaTime);
      this.updateResidentHandoff(deltaTime);
      const actorIsAvatar = this.isResidentRepresentedByAvatar();
      if (this.shedSkinTrailSystem?.container) this.shedSkinTrailSystem.container.visible = this.residentRevealVisible && !actorIsAvatar;
      if (this.residentRevealVisible && !actorIsAvatar) {
        this.shedSkinTrailSystem?.update(
          deltaTime,
          this.actor.headState,
          renderConfig.phenomena.shedSkin,
          { scaleMultiplier: this.residentHandoff?.scaleMultiplier ?? 1 }
        );
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
        runtime.reaction.modifiers,
        { background: renderConfig.scene.environment.type === 'illustrated' }
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
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.isReady = false;
    this.assetReloadRequested = false;
    this.assetReloadScheduled = false;
    ++this.loadSequence;
    this.actorScreenPositionTarget = null;

    if (this.unsubscribers) {
      this.unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      this.unsubscribers = [];
    }

    this.destroySceneResources();
    if (this.appInitialized) this.destroyApplication();
  }

  destroySceneResources() {
    try {
      this.shedSkinTrailSystem?.destroy();
      this.shedSkinTrailSystem = null;
      if (this.actor?.characterContentContainer) this.actor.characterContentContainer.mask = null;
      this.actor?.destroy();
      this.actor = null;
      this.stage?.destroy?.();
      this.stage = null;
      this.renderTextureManager?.destroy?.();
      this.renderTextureManager = null;
      this.trailSystem?.destroy?.();
      this.trailSystem = null;
      this.shockwaveSystem?.destroy?.();
      this.shockwaveSystem = null;
      this.searchlightSystem?.destroy?.();
      this.searchlightSystem = null;
      if (this.loadedRig?.verifiedLoadQueue?.length > 0) Assets.unload(this.loadedRig.verifiedLoadQueue).catch(() => {});
      this.loadedRig = null;
    } catch (error) {
      reportControlledError('pixi-scene-cleanup', error);
    }
  }

  destroyApplication() {
    if (this.appDestroyed || !this.app) return;
    this.appDestroyed = true;
    try {
      this.app.destroy(true, { children: true, texture: true });
    } catch (error) {
      reportControlledError('pixi-application-cleanup', error);
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
