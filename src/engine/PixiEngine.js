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

    // Direct canvas DOM reference cache to prevent nullified getter calls on destroy
    this.canvasElement = null;

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
    
    // Decoupled keys mapping: this.assetKeys preserves assets loading references while
    // this.keys processes WASD & Arrow keyboard coordinate flight tracking safely
    this.assetKeys = {}; 
    this.keys = { 
      KeyW: false, 
      KeyA: false, 
      KeyS: false, 
      KeyD: false, 
      ArrowUp: false, 
      ArrowDown: false, 
      ArrowLeft: false, 
      ArrowRight: false 
    };

    // Phase 2C Custom Speed Parameter
    this.playerSpeed = 500; // Modify this value to adjust character WASD movement speed

    // Phase 2B & 2C: Weapon, Swarm Mechanics, Particles & Progression Variables
    this.playerProjectiles = [];
    this.enemies = [];
    this.impactParticles = [];
    
    this.recoilOffset = { x: 0, y: 0 };
    this.recoilGlitch = 0.0;
    this.lastSpawnTime = 0;

    this.enemySpawnTimer = 0.0;
    this.spawnInterval = 1.8; // Base interval in seconds
    
    this.enemiesSpawnedInWave = 0;
    this.totalEnemiesToSpawnInWave = 0;
    this.enemiesDefeatedInWave = 0;
    
    this.isWaveTransitionActive = false;
    this.waveTransitionTimer = 0.0;

    // Phase 2C Mouse Button holding state trackers
    this.isPointerDown = false;
    this.pointerPosition = { x: 0, y: 0 };
    this.fireCooldown = 0.0;

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

    // Spring Drift Navigation State Variables
    this.baselinePosition = { x: 0, y: 0 };   // The floating anchor position
    this.targetPosition = { x: 0, y: 0 };     // The destination coordinates set on click
    this.isMovingToTarget = false;            // Movement status flag
    this.facingDirection = 1.0;               // Target flip direction (1.0 = right, -1.0 = left)
    this.currentFlipScale = 1.0;              // Smoothly interpolated flip scale ratio

    this.config = { ...useStore.getState() };

    // Setup clear window key event listeners
    this.handleKeyDown = (e) => {
      if (e.code in this.keys) {
        this.keys[e.code] = true;
      }
    };

    this.handleKeyUp = (e) => {
      if (e.code in this.keys) {
        this.keys[e.code] = false;
      }
    };

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    // Native mouse/pointer event listeners to support seamless auto-firing on hold
    this.handlePointerDown = (e) => {
      this.isPointerDown = true;
      this.pointerPosition = { x: e.clientX, y: e.clientY };
    };

    this.handlePointerUp = () => {
      this.isPointerDown = false;
    };

    this.handlePointerMove = (e) => {
      this.pointerPosition = { x: e.clientX, y: e.clientY };
    };

    this.unsubscribeStore = useStore.subscribe((state) => {
      const prevChar = this.config.characterId;
      const prevBgClip = this.config.bgClippingMaskId;
      const prevBgStyle = this.config.bgPatternStyle;
      const prevBgMountain = this.config.bgMountainId;
      const prevBgMountainBack = this.config.bgMountainBackId;
      const prevGameState = this.config.gameState;

      const prevReaction = this.config.activeReaction;
      const nextReaction = state.activeReaction;
      const prevProgress = this.config.reactionProgress;
      const nextProgress = state.reactionProgress;

      this.config = state;

      // Detect transaction start or restart trigger signals
      if (nextReaction !== null && (prevReaction !== nextReaction || nextProgress === 1.0)) {
        this.startLocalReaction(nextReaction);
      }

      // Check transition states for gameplay mode shifts
      if (prevGameState !== state.gameState) {
        this.handleGameStateTransition(state.gameState);
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
   * Orchestrates visual parameters and assets visibility changes between menu and descent flight viewports.
   */
  handleGameStateTransition(gameState) {
    const setParameter = useStore.getState().setParameter;

    if (gameState === "gameplay") {
      this.isMovingToTarget = false;

      // Reset coordinates to clear old arrays [3]
      this.clearGameplayObjects();

      // Reset Player Statistics
      setParameter("playerHP", 100);
      setParameter("playerShield", 100);
      setParameter("gameScore", 0);
      setParameter("gameActiveWave", 1);

      // Compute total spawning thresholds for Chapter 1
      this.enemiesSpawnedInWave = 0;
      this.enemiesDefeatedInWave = 0;
      this.totalEnemiesToSpawnInWave = 5; 
      this.isWaveTransitionActive = false;
      this.waveTransitionTimer = 0.0;

      // Pivot mechanical skull to a left-side offset starting position scaled appropriately
      const screenWidth = this.app.screen.width;
      const currentScale = this.masterContainer?.scale.x || 1.0;
      const localLeftX = -(screenWidth * 0.35) / currentScale;

      this.baselinePosition = { x: localLeftX, y: 0 };
      this.recoilOffset = { x: 0, y: 0 };
      this.facingDirection = 1.0;
      this.currentFlipScale = 1.0;

      // Transition to fast active flight scrolling velocity
      setParameter("bgScrollSpeed", 220.0);

      // Restore cavern background elements
      if (this.bgAtmosphereContainer) {
        this.bgAtmosphereContainer.visible = true;
      }
      if (this.searchlightSystem) {
        this.searchlightSystem.setActive(this.config.searchlightActive);
      }
      if (this.bgFog && this.bgFog.sprite) {
        this.bgFog.sprite.visible = true;
      }
      if (this.fgFog && this.fgFog.sprite) {
        this.fgFog.sprite.visible = true;
      }
    } else if (gameState === "menu") {
      this.baselinePosition = { x: 0, y: 0 };
      this.recoilOffset = { x: 0, y: 0 };
      this.facingDirection = 1.0;
      this.currentFlipScale = 1.0;

      this.isPointerDown = false;

      // Revert to slow background idle scroll speed
      setParameter("bgScrollSpeed", 30.0);

      // Cleanly prune active gameplay arrays
      this.clearGameplayObjects();

      // Cleanly isolate character view inside the terminal
      if (this.bgAtmosphereContainer) {
        this.bgAtmosphereContainer.visible = false;
      }
      if (this.searchlightSystem) {
        this.searchlightSystem.setActive(false);
      }
      if (this.bgFog && this.bgFog.sprite) {
        this.bgFog.sprite.visible = false;
      }
      if (this.fgFog && this.fgFog.sprite) {
        this.fgFog.sprite.visible = false;
      }
    }
  }

  /**
   * Tracks target coordinates relative to the active canvas bounding dimensions.
   */
  updateMousePos(localX, localY, canvasWidth, canvasHeight) {
    const w = canvasWidth || window.innerWidth;
    const h = canvasHeight || window.innerHeight;

    this.absoluteMousePos.x = localX;
    this.absoluteMousePos.y = localY;

    // Normalize coordinates relative to local canvas dimensions to keep pupil tracking stable [3]
    this.normalizedMousePos.x = (localX / w) * 2 - 1;
    this.normalizedMousePos.y = (localY / h) * 2 - 1;
  }

  /**
   * Fires weapon structures when user interaction click events occur.
   */
  updateMouseClick(localX, localY) {
    if (this.config.gameState === 'gameplay') {
      this.spawnProjectile(localX, localY);
    }
  }

  /**
   * Spawns a physical tracer round from orbital coordinate positions towards the screen cursor.
   * Modulates a transient recoil offset to execute spring-back mechanical kickbacks and brief visual glitch flashes.
   */
  spawnProjectile(clientX, clientY) {
    const now = Date.now();
    // Debounce to safeguard against overlapping browser click dispatch threads
    if (now - this.lastSpawnTime < 15) return;
    this.lastSpawnTime = now;

    if (!this.masterContainer || !this.headContainer || !this.isReady) return;

    // Translate global screen interaction points to local coordinates inside master container bounds [3]
    const localTarget = this.masterContainer.toLocal({ x: clientX, y: clientY });
    const localCenter = this.headContainer.position;

    const dx = localTarget.x - localCenter.x;
    const dy = localTarget.y - localCenter.y;
    const angle = Math.atan2(dy, dx);

    // Retrieve active orbital tracking radius [3]
    const orbitRadius = this.config.searchlightRadius ?? 110;

    // Calculate spawning position matching searchlight base on orbital perimeter bounds
    const startX = localCenter.x + Math.cos(angle) * orbitRadius;
    const startY = localCenter.y + Math.sin(angle) * orbitRadius;

    // Memoize the high-visibility tracer texture [3]
    if (!SearchlightSystem.tracerTexture) {
      SearchlightSystem.tracerTexture = SearchlightSystem.generateTracerTexture();
    }

    const bullet = new Sprite(SearchlightSystem.tracerTexture);
    bullet.anchor.set(0.5, 0.5);
    bullet.position.set(startX, startY);
    bullet.rotation = angle; // Symmetrically align bullet rotation around its center

    // Add directly to masterContainer to inherit global stage scaling and remain visible
    this.masterContainer.addChild(bullet);

    // Solid, visible velocity rate: 950 pixels per second
    this.playerProjectiles.push({
      sprite: bullet,
      vx: Math.cos(angle) * 950,
      vy: Math.sin(angle) * 950
    });

    // Apply recoil kickback force directly to transient recoilOffset (recoil force of 12px)
    this.recoilOffset.x -= Math.cos(angle) * 12;
    this.recoilOffset.y -= Math.sin(angle) * 12;

    // Single-frame CRT electromagnetic distortion spike mimicking muzzle flash
    this.recoilGlitch = 10.0;
  }

  /**
   * Spawns spark particle groups representing bullet impacts or hostile destructions.
   * @param {number} x - Local coordinate horizontal center.
   * @param {number} y - Local coordinate vertical center.
   * @param {number} count - Total particle dots to instantiate.
   * @param {boolean} isExplosion - Flag denoting if a larger, slower flame orange blast occurs.
   */
  spawnSparks(x, y, count, isExplosion = false) {
    for (let i = 0; i < count; i++) {
      const spark = new Graphics()
        .circle(0, 0, isExplosion ? Math.random() * 4 + 2 : Math.random() * 3 + 1)
        .fill({ color: isExplosion ? 0xff4d00 : 0xffaa00 });
      
      spark.position.set(x, y);

      const angle = Math.random() * Math.PI * 2;
      const velocity = isExplosion ? Math.random() * 260 + 100 : Math.random() * 180 + 80;

      this.masterContainer.addChild(spark);
      
      this.impactParticles.push({
        graphic: spark,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        alpha: 1.0,
        life: isExplosion ? 0.6 : 0.4,
        maxLife: isExplosion ? 0.6 : 0.4
      });
    }
  }

  /**
   * Cleanly prunes and destroys active projectiles.
   */
  clearProjectiles() {
    if (this.playerProjectiles && this.playerProjectiles.length > 0) {
      this.playerProjectiles.forEach(proj => {
        if (proj.sprite) {
          if (this.masterContainer) {
            this.masterContainer.removeChild(proj.sprite);
          }
          proj.sprite.destroy();
        }
      });
      this.playerProjectiles = [];
    }
  }

  /**
   * Clears and destroys active gameplay entities, particles, and swarm components safely.
   */
  clearGameplayObjects() {
    this.clearProjectiles();

    if (this.enemies && this.enemies.length > 0) {
      this.enemies.forEach(enemy => {
        if (enemy.sprite) {
          if (this.masterContainer) {
            this.masterContainer.removeChild(enemy.sprite);
          }
          enemy.sprite.destroy();
        }
      });
      this.enemies = [];
    }

    if (this.impactParticles && this.impactParticles.length > 0) {
      this.impactParticles.forEach(part => {
        if (part.graphic) {
          if (this.masterContainer) {
            this.masterContainer.removeChild(part.graphic);
          }
          part.graphic.destroy();
        }
      });
      this.impactParticles = [];
    }

    this.enemiesSpawnedInWave = 0;
    this.enemiesDefeatedInWave = 0;
    this.isWaveTransitionActive = false;
    this.waveTransitionTimer = 0.0;
    this.isPointerDown = false;
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

      // Cache a direct reference to the canvas element before unmount cycles occur
      this.canvasElement = this.app.canvas;

      this.container.appendChild(this.canvasElement);

      // Setup native canvas-level pointer down continuous auto-firing listeners on the cached element
      this.canvasElement.addEventListener('pointerdown', this.handlePointerDown);
      window.addEventListener('pointerup', this.handlePointerUp);
      this.canvasElement.addEventListener('pointermove', this.handlePointerMove);
      
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
      console.error("Failed to boot PixiEngine:", err);
    }
  }

  async loadAssets() {
    console.log(`%c🔍 [PixiEngine] Rig Loader: Locating Stage Assets`, 'color: #00f3ff; font-weight: bold;');
    
    const results = await AssetResolver.resolveRig(this.config);
    
    this.assetKeys = results.keys;
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

    let clipTex = Assets.get(this.assetKeys.char_clipping_mask);
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
      bgPat1Alias: this.hasBgPat1 ? this.assetKeys.bg_pat_1 : null,
      bgPat2Alias: this.hasBgPat2 ? this.assetKeys.bg_pat_2 : null,
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
        this.layers.bg_clip = createSprite(this.assetKeys.bg_clipping_mask);
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
        const mountainBackTex = Assets.get(this.assetKeys.bg_mountain_back);
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
        const mountainTex = Assets.get(this.assetKeys.bg_mountain);
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
    this.trailSystem = new TrailSystem(this.masterContainer, this.hasCharClippingMask ? this.assetKeys.char_clipping_mask : null);

    // Initialize Volumetric Searchlight System
    this.searchlightSystem = new SearchlightSystem(this.masterContainer);
    this.searchlightSystem.isActiveOverride = true;
    this.searchlightSystem.setActive = (active) => {
      this.searchlightSystem.isActiveOverride = active;
      if (this.searchlightSystem.container) {
        this.searchlightSystem.container.visible = active;
      }
    };

    // 2. Head Container
    this.headContainer = new Container();
    this.masterContainer.addChild(this.headContainer);

    // Blurry shadow glow container (renders underneath head lineart/features)
    if (this.hasCharClippingMask) {
      this.layers.aura = createSprite(this.assetKeys.char_clipping_mask);
      this.headContainer.addChild(this.layers.aura);
    }

    // Nested composition to decouple filters from the mask sprite
    if (this.hasCharClippingMask) {
      // The mask sprite (must be set as renderable=false so it does not draw as a solid colored block)
      const charMaskSprite = createSprite(this.assetKeys.char_clipping_mask);
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
      this.layers.base = createSprite(this.assetKeys.char_clipping_mask);
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
      this.layers.lineart = createSprite(this.assetKeys.char_lineart);
      this.headContainer.addChild(this.layers.lineart);
    }

    // Render eyeballs and lids
    this.eyeSystem = new EyeSystem(this.headContainer, {
      discoveredEyes: this.discoveredEyes,
      hasEyelids: this.hasEyelids,
      eyelidsTopAlias: this.hasEyelids ? this.assetKeys.eyelids_top : null,
      eyelidsBottomAlias: this.hasEyelids ? this.assetKeys.eyelids_bottom : null
    });

    // Decoupled Foreground Fog Layer (placed on top of character but below overlays)
    this.fgFog = new FogSystem(this.masterContainer, this.bgHeightScale, true);

    // Call the game state handler to establish initial isolated scenery visibility settings correctly
    this.handleGameStateTransition(this.config.gameState);
  }

  update(deltaTime) {
    if (!this.isReady) return;
    const dtSeconds = deltaTime / 60;
    this.time += dtSeconds;

    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;
    const currentScale = this.masterContainer.scale.x;

    // Smoothly decay transient recoil offset back to zero on every frame
    this.recoilOffset.x += (0 - this.recoilOffset.x) * 0.15 * deltaTime;
    this.recoilOffset.y += (0 - this.recoilOffset.y) * 0.15 * deltaTime;

    // --- Phase 2: Internal Reaction Decay Step ---
    if (this.currentLocalReaction && this.originalPreset) {
      this.localReactionProgress -= 0.007 * deltaTime;

      if (this.localReactionProgress <= 0) {
        this.localReactionProgress = 0;
        this.currentLocalReaction = null;
        this.originalPreset = null;

        // Reset the store values once when the decay concludes
        const setParameter = useStore.getState().setParameter;
        setParameter("activeReaction", null);
        setParameter("reactionProgress", 0.0);
      } else {
        // Sync progress dynamically to the store so the Tab indicator updates
        useStore.getState().setParameter("reactionProgress", this.localReactionProgress);
      }
    }

    // --- Active Gameplay Flight Navigation vs. Spring Menu Drift ---
    // --- Active Gameplay Flight Navigation vs. Spring Menu Drift ---
    if (this.config.gameState === "gameplay") {
      // WASD / Arrow keyboard vector mapping utilizing custom speed parameter
      const speed = this.playerSpeed * dtSeconds;
      let moveX = 0;
      let moveY = 0;

      if (this.keys.KeyW || this.keys.ArrowUp) moveY -= 1;
      if (this.keys.KeyS || this.keys.ArrowDown) moveY += 1;
      if (this.keys.KeyA || this.keys.ArrowLeft) moveX -= 1;
      if (this.keys.KeyD || this.keys.ArrowRight) moveX += 1;

      // Normalize diagonal vectors to prevent speed boosting mechanics
      if (moveX !== 0 && moveY !== 0) {
        const length = Math.sqrt(moveX * moveX + moveY * moveY);
        moveX /= length;
        moveY /= length;
      }

      this.baselinePosition.x += moveX * speed;
      this.baselinePosition.y += moveY * speed;

      const localHalfW = (screenWidth / currentScale) / 2;
      const localHalfH = (screenHeight / currentScale) / 2;

      // Clamp coordinates to allow movement across the complete width / canvas height
      const minX = -localHalfW + 60;
      const maxX = localHalfW - 60; // Expanded to full screen boundary width

      const minY = -localHalfH + 60; // Expanded to full screen boundary height
      const maxY = localHalfH - 60;

      this.baselinePosition.x = Math.max(minX, Math.min(maxX, this.baselinePosition.x));
      this.baselinePosition.y = Math.max(minY, Math.min(maxY, this.baselinePosition.y));

      // Dynamically flip character based on relative cursor position to head container
      const localMouse = this.masterContainer.toLocal({ x: this.absoluteMousePos.x, y: this.absoluteMousePos.y });
      this.facingDirection = localMouse.x >= this.headContainer.position.x ? 1.0 : -1.0;
      this.currentFlipScale += (this.facingDirection - this.currentFlipScale) * 0.2 * deltaTime;
    } else {
      // Menu Mode: Force stationary central positioning inside terminal items window
      this.baselinePosition.x = 0;
      this.baselinePosition.y = 0;

      // Smooth 3D rotational flipping based on mouse hover position
      this.facingDirection = this.normalizedMousePos.x >= 0 ? 1.0 : -1.0;
      this.currentFlipScale += (this.facingDirection - this.currentFlipScale) * 0.2 * deltaTime;
    }

    // Synthesize latest coordinates dynamically so that EyeSystem and nested modules receive updates
    const config = { ...this.config, mousePos: this.normalizedMousePos };

    // Continuous weapon auto-firing when holding down the mouse button
    if (this.fireCooldown > 0) {
      this.fireCooldown -= dtSeconds;
    }
    if (config.gameState === "gameplay" && this.isPointerDown && this.fireCooldown <= 0) {
      this.spawnProjectile(this.pointerPosition.x, this.pointerPosition.y);
      this.fireCooldown = 0.18; // Fires continuous stream at comfortable 180ms intervals
    }

    // Apply recoil muzzle flash distortion spikes
    if (this.recoilGlitch > 0) {
      config.aberrationAmount += this.recoilGlitch;
      this.recoilGlitch = 0; // Return to standard settings immediately on the next frame
    }

    // Apply internal decay overrides over baseline configurations
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

    // --- Phase 2B: Glitch Active Evaluation ---
    const isGlitchActive = (isGlitched || currentSplit > (config.aberrationAmount * 1.15));

    // --- Phase 2C: Cavern Swarm Spawner Logic ---
    if (config.gameState === "gameplay" && !this.isWaveTransitionActive) {
      this.enemySpawnTimer += dtSeconds;

      if (this.enemiesSpawnedInWave < this.totalEnemiesToSpawnInWave && this.enemySpawnTimer >= this.spawnInterval) {
        this.enemySpawnTimer = 0.0;

        // Spawn from right edge of screen bounds in local container coordinates
        const spawnX = (screenWidth / 2 + 80) / currentScale;
        const spawnY = ((Math.random() - 0.5) * (screenHeight - 240)) / currentScale;

        // Retrieve mapped striped enemy skull texture
        const enemyTexture = Assets.get('enemy_skull_striped');
        const enemySprite = new Sprite(enemyTexture);
        enemySprite.anchor.set(0.5);
        enemySprite.scale.set(0.38);

        // Adjust coloration slightly to represent hostile alignment
        enemySprite.tint = 0xff5533;
        enemySprite.position.set(spawnX, spawnY);

        this.masterContainer.addChild(enemySprite);

        // Dynamically scale parameters based on the store's current active wave
        const waveMultiplier = config.gameActiveWave;
        const enemyHP = 1 + Math.floor(waveMultiplier * 0.4);
        const enemySpeed = 160 + (waveMultiplier * 15);

      this.enemies.push({
          sprite: enemySprite,
          hp: enemyHP,
          maxHp: enemyHP,
          speed: enemySpeed,
          facingDirection: -1.0, // Default to facing left (spawns on the right)
          currentFlipScale: -1.0
        });

        this.enemiesSpawnedInWave++;
      }
    }

    // --- Phase 2B: Tracer Projectile Propagation & Boundary Cleanups ---
    if (this.playerProjectiles && this.playerProjectiles.length > 0) {
      for (let i = this.playerProjectiles.length - 1; i >= 0; i--) {
        const proj = this.playerProjectiles[i];
        proj.sprite.x += proj.vx * dtSeconds;
        proj.sprite.y += proj.vy * dtSeconds;

        const globalPos = proj.sprite.getGlobalPosition();
        if (
          globalPos.x < -100 || 
          globalPos.x > screenWidth + 100 || 
          globalPos.y < -100 || 
          globalPos.y > screenHeight + 100
        ) {
          if (this.masterContainer) {
            this.masterContainer.removeChild(proj.sprite);
          }
          proj.sprite.destroy();
          this.playerProjectiles.splice(i, 1);
        }
      }
    }

    // --- Phase 2C: Enemy Swarm Processing (Active 2D vector pursuit tracking & scale flips) ---
    if (this.enemies && this.enemies.length > 0) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        
        // Active pursuit tracking vector calculations
        const playerX = this.headContainer.position.x;
        const playerY = this.headContainer.position.y;

        const dx = playerX - enemy.sprite.x;
        const dy = playerY - enemy.sprite.y;
        const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

        if (distanceToPlayer > 0) {
          // Direct 2D movement towards player coordinates (keeps chasing endlessly)
          enemy.sprite.x += (dx / distanceToPlayer) * enemy.speed * dtSeconds;
          enemy.sprite.y += (dy / distanceToPlayer) * enemy.speed * dtSeconds;
        }

       // Dynamic visual flip calculation based on player relative position
        const baseScale = 0.38;
        enemy.facingDirection = dx >= 0 ? 1.0 : -1.0;

        // Smoothly interpolate the enemy's scale using the same formula as the player
        enemy.currentFlipScale += (enemy.facingDirection - enemy.currentFlipScale) * 0.2 * deltaTime;
        enemy.sprite.scale.x = baseScale * enemy.currentFlipScale;

        // Off-screen boundary checks (only prunes extreme outliers far outside the play area)
        const outerBoundaryLimit = (screenWidth / currentScale) * 1.5;
        if (Math.abs(enemy.sprite.x) > outerBoundaryLimit || Math.abs(enemy.sprite.y) > outerBoundaryLimit) {
          if (this.masterContainer) {
            this.masterContainer.removeChild(enemy.sprite);
          }
          enemy.sprite.destroy();
          this.enemies.splice(i, 1);
          
          this.enemiesDefeatedInWave++;
        }
      }
    }

    // --- Phase 2C: Dual-Layer Collision Matrices & Particles ---
    if (config.gameState === "gameplay") {
      const shieldRadius = config.searchlightRadius ?? 110;
      const collisionRadius = 35.0; // Dynamic overlapping radius target boundary

      // 1. PROJECTILE-TO-ENEMY COLLISIONS
      for (let pIdx = this.playerProjectiles.length - 1; pIdx >= 0; pIdx--) {
        const proj = this.playerProjectiles[pIdx];

        for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
          const enemy = this.enemies[eIdx];

          const dx = proj.sprite.x - enemy.sprite.x;
          const dy = proj.sprite.y - enemy.sprite.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < collisionRadius) {
            // Spawn fast impact burst of golden spark particles
            this.spawnSparks(proj.sprite.x, proj.sprite.y, Math.floor(Math.random() * 4) + 5, false);

            // Destroy Projectile
            if (this.masterContainer) {
              this.masterContainer.removeChild(proj.sprite);
            }
            proj.sprite.destroy();
            this.playerProjectiles.splice(pIdx, 1);

            // Deduct Enemy Hit Points
            enemy.hp--;

            if (enemy.hp <= 0) {
              // Trigger larger 15-particle explosion burst
              this.spawnSparks(enemy.sprite.x, enemy.sprite.y, 15, true);

              // Remove enemy from stage
              if (this.masterContainer) {
                this.masterContainer.removeChild(enemy.sprite);
              }
              enemy.sprite.destroy();
              this.enemies.splice(eIdx, 1);

              this.enemiesDefeatedInWave++;

              // Increment Score State
              const currentScore = useStore.getState().gameScore;
              useStore.getState().setParameter("gameScore", currentScore + 100);
            }

            break; // Bullet consumed, advance outer projectile queue
          }
        }
      }

      // 2. ENEMY-TO-PLAYER (Shield Boundary) COLLISIONS
      for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
        const enemy = this.enemies[eIdx];

        const dx = enemy.sprite.x - this.headContainer.position.x;
        const dy = enemy.sprite.y - this.headContainer.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < shieldRadius) {
          // Instantly destroy hitting swarm enemy
          if (this.masterContainer) {
            this.masterContainer.removeChild(enemy.sprite);
          }
          enemy.sprite.destroy();
          this.enemies.splice(eIdx, 1);

          this.enemiesDefeatedInWave++;

          // Spawn heavy fiery splash particles
          this.spawnSparks(enemy.sprite.x, enemy.sprite.y, 12, true);

          // Deduct Shield / HP metrics
          const currentShield = useStore.getState().playerShield;
          const currentHP = useStore.getState().playerHP;
          const impactDamage = 15;

          if (currentShield > 0) {
            const nextShield = Math.max(0, currentShield - impactDamage);
            useStore.getState().setParameter("playerShield", nextShield);
          } else {
            const nextHP = Math.max(0, currentHP - impactDamage);
            useStore.getState().setParameter("playerHP", nextHP);

            // Handle Game Over transition resets
            if (nextHP <= 0) {
              useStore.getState().setParameter("gameState", "menu");
            }
          }

          // Visceral gameplay impact camera shake feedback
          this.recoilOffset.x = (Math.random() - 0.5) * 45;
          this.recoilOffset.y = (Math.random() - 0.5) * 45;

          // Spike visual glitch splits
          this.recoilGlitch = 20.0;

          // Momentary screen shake modifier spike
          useStore.getState().setParameter("glitchShakeIntensity", 25);
          setTimeout(() => {
            // Restore previous user/store parameter limits smoothly
            if (!this.isDestroyed) {
              useStore.getState().setParameter("glitchShakeIntensity", 0);
            }
          }, 450);
        }
      }

      // 3. WAVE TIMING & PROGRESSION CHECK
      if (this.enemiesDefeatedInWave >= this.totalEnemiesToSpawnInWave && this.enemies.length === 0) {
        if (!this.isWaveTransitionActive) {
          this.isWaveTransitionActive = true;
          this.waveTransitionTimer = 3.0; // 3 second transition delay
        }
      }
    }

    // Process transition timer delay tick
    if (this.isWaveTransitionActive && config.gameState === "gameplay") {
      this.waveTransitionTimer -= dtSeconds;
      if (this.waveTransitionTimer <= 0.0) {
        this.isWaveTransitionActive = false;

        // Advance Wave level index
        const nextWaveLevel = config.gameActiveWave + 1;
        useStore.getState().setParameter("gameActiveWave", nextWaveLevel);

        this.enemiesSpawnedInWave = 0;
        this.enemiesDefeatedInWave = 0;

        // Increment swarm scale counts
        this.totalEnemiesToSpawnInWave = 5 + (nextWaveLevel * 3);
        this.spawnInterval = Math.max(0.6, 1.8 - (nextWaveLevel * 0.1));
      }
    }

    // --- Phase 2C: Propagation of Spark/Splash Particles ---
    if (this.impactParticles && this.impactParticles.length > 0) {
      for (let i = this.impactParticles.length - 1; i >= 0; i--) {
        const p = this.impactParticles[i];
        p.graphic.x += p.vx * dtSeconds;
        p.graphic.y += p.vy * dtSeconds;
        
        p.life -= dtSeconds;
        p.alpha = Math.max(0, p.life / p.maxLife);
        p.graphic.alpha = p.alpha;

        if (p.life <= 0.0) {
          if (this.masterContainer) {
            this.masterContainer.removeChild(p.graphic);
          }
          p.graphic.destroy();
          this.impactParticles.splice(i, 1);
        }
      }
    }

    // --- Flight & Hover Subsystem Calculations ---
    const headState = this.flightDynamics.calculate(this.time, config, isGlitchActive, this.baselinePosition, this.currentFlipScale);

    // Set head container position combining flight dynamics with elastic spring recoil offsets
    this.headContainer.position.set(
      headState.x + this.recoilOffset.x, 
      headState.y + this.recoilOffset.y
    );
    this.headContainer.scale.set(headState.scaleX, headState.scale); // Independent scale assignment to allow horizontal flip rotations
    this.headContainer.rotation = headState.rotation;

    // --- Searchlight Volumetric System Updates (Orbiting turret tracking mouse) ---
    // (Bypassed / Temporarily unavailable for testing as requested)
    if (this.searchlightSystem) {
      this.searchlightSystem.update(this.headContainer.position, this.absoluteMousePos, deltaTime, config);
    }

    // --- WebGL Portal Refraction Ripple Subsystem updates ---
    if (this.shockwaveSystem) {
      const hasActiveWaves = this.shockwaveSystem.update(
        dtSeconds, 
        screenWidth, 
        screenHeight, 
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
        screenWidth,
        screenHeight
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
    
    const clipTex = Assets.get(this.assetKeys.char_clipping_mask) || Assets.get('bg');
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

    // Remove window keyboard trackers
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);

    if (this.unsubscribeStore) {
      this.unsubscribeStore();
    }

    // Clean up continuous auto-fire pointer tracking using our cached DOM canvas reference
    if (this.canvasElement) {
      try {
        this.canvasElement.removeEventListener('pointerdown', this.handlePointerDown);
        this.canvasElement.removeEventListener('pointermove', this.handlePointerMove);
      } catch (e) {
        // Safe catch
      }
      this.canvasElement = null;
    }
    window.removeEventListener('pointerup', this.handlePointerUp);

    // Clean up active projectiles, swarms, and particle groups
    this.clearGameplayObjects();

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
        
        // Fix standard asset texture cache warnings [3]
        this.app.destroy(true, { children: true, texture: false }); 
      } catch (e) {
        console.warn("[PixiEngine] Strict cleanup warn:", e);
      }
    }
  }
}