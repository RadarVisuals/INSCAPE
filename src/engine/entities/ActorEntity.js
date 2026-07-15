// src/engine/entities/ActorEntity.js
import { Assets, Container, Matrix, RenderTexture, Sprite } from 'pixi.js';
import { EyeSystem } from '../systems/EyeSystem.js';
import { FlightDynamics } from '../systems/FlightDynamics.js';
import { createCaptiveWeatherOverlay, createVeinPulseOverlay } from './CharacterPhenomenaMeshFactory.js';
import { VeinPulseSystem } from '../systems/VeinPulseSystem.js';
import { CaptiveWeatherSystem } from '../systems/CaptiveWeatherSystem.js';
import { createActorMutationMesh } from './ActorMutationMeshFactory.js';
import { createTrailRenderTransformSnapshot } from '../systems/trailRuntime.js';

const MUTATION_MODE_VALUES = {
  none: 0,
  mirrorX: 1,
  mirrorY: 2,
  quad: 3
};

export class ActorEntity {
  constructor(id, assets, renderTextureManager, renderer = null) {
    this.id = id;
    this.assets = assets;
    this.renderTextureManager = renderTextureManager;
    this.renderer = renderer;

    this.container = new Container();
    this.container.label = `actor_${id}`;
    this.visualContainer = new Container();
    this.visualContainer.label = `actor_visual_${id}`;

    this.baseActorScale = 0.5;

    this.baselinePosition = { x: 0, y: 0 };
    this.targetPosition = { x: 0, y: 0 };
    this.isMovingToTarget = false;
    this.facingDirection = 1.0;
    this.currentFlipScale = 1.0;
    this.flightDynamics = new FlightDynamics();
    this.eyeSystem = null;
    this.layers = {};
    this.phenomenaMeshes = [];
    this.veinPulseSystem = null;
    this.captiveWeatherSystem = null;
    this.authoredSourceContainer = null;
    this.authoredSourceTexture = null;
    this.authoredSourcePlacement = null;
    this.actorMutationMesh = null;
    this.autoRotationDegrees = 0;
    this.headState = { x: 0, y: 0, scale: 1, scaleX: 1, rotation: 0 };
    this.warpTextureSize = { width: 2000, height: 2000 };
    this.warpPointer = {
      position: [0.5, 0.5],
      velocity: [0.0, 0.0],
      active: 0.0,
      initialized: false
    };
    
    this.characterContentContainer = null;

    this.build();
  }

  build() {
    const createSprite = (alias) => {
      const s = Sprite.from(alias);
      s.anchor.set(0.5);
      return s;
    };

    const maskTexture = this.assets.char_clipping_mask
      ? Assets.get(this.assets.char_clipping_mask)
      : null;
    if (maskTexture?.width && maskTexture?.height) {
      this.warpTextureSize.width = maskTexture.width;
      this.warpTextureSize.height = maskTexture.height;
    }

    this.authoredSourceContainer = new Container();
    this.authoredSourceContainer.label = `actor_source_${this.id}`;

    if (this.assets.char_clipping_mask) {
      this.layers.aura = createSprite(this.assets.char_clipping_mask);
      this.container.addChild(this.layers.aura);
    }

    this.container.addChild(this.visualContainer);

    if (this.assets.char_clipping_mask) {
      const charMaskSprite = createSprite(this.assets.char_clipping_mask);
      this.layers.mask = charMaskSprite;
      this.authoredSourceContainer.addChild(charMaskSprite);

      this.characterContentContainer = new Container();
      
      // Standard native mask assignment with explicit alpha channel decoding.
      // PixiJS v8 default sprite mask behavior samples the red channel (great for grayscale, 
      // but fails if the mask uses high alpha transparency with negligible red values).
      this.characterContentContainer.setMask({
        mask: charMaskSprite,
        channel: 'alpha'
      });
      this.authoredSourceContainer.addChild(this.characterContentContainer);

      this.layers.base = createSprite(this.assets.char_base || this.assets.char_clipping_mask);
      this.characterContentContainer.addChild(this.layers.base);

      const weatherOverlay = createCaptiveWeatherOverlay(maskTexture);
      const veinOverlay = createVeinPulseOverlay(maskTexture);
      this.phenomenaMeshes.push(weatherOverlay, veinOverlay);
      this.authoredSourceContainer.addChild(weatherOverlay.mesh, veinOverlay.mesh);
      this.captiveWeatherSystem = new CaptiveWeatherSystem([weatherOverlay]);
      this.veinPulseSystem = new VeinPulseSystem([veinOverlay]);
    }

    if (
      this.characterContentContainer &&
      this.assets.discoveredPatterns &&
      this.assets.discoveredPatterns.length > 0 &&
      this.renderTextureManager
    ) {
      const patternSprite = new Sprite(this.renderTextureManager.patternRenderTexture);
      patternSprite.anchor.set(0.5);
      this.layers.pattern = patternSprite;
      this.characterContentContainer.addChild(patternSprite);
    }

    if (this.assets.char_lineart) {
      this.layers.lineart = createSprite(this.assets.char_lineart);
      this.authoredSourceContainer.addChild(this.layers.lineart);
    }

    if (this.assets.discoveredEyes && this.assets.discoveredEyes.length > 0) {
      this.eyeSystem = new EyeSystem(this.authoredSourceContainer, {
        discoveredEyes: this.assets.discoveredEyes,
        hasEyelids: !!this.assets.eyelids_top,
        eyelidsTopAlias: this.assets.eyelids_top || null,
        eyelidsBottomAlias: this.assets.eyelids_bottom || null
      });
    }

    if (maskTexture?.width && maskTexture?.height) {
      this.buildAuthoredMutationSurface(maskTexture.width, maskTexture.height);
    }
  }

  buildAuthoredMutationSurface(width, height) {
    this.authoredSourceTexture = RenderTexture.create({
      width,
      height,
      resolution: 1
    });
    this.authoredSourcePlacement = new Matrix(1, 0, 0, 1, width / 2, height / 2);
    this.actorMutationMesh = createActorMutationMesh(this.authoredSourceTexture, width, height);
    this.layers.mutationBody = this.actorMutationMesh.mesh;
    this.visualContainer.addChild(this.actorMutationMesh.mesh);
  }

  renderAuthoredMutationSource() {
    if (!this.renderer || !this.authoredSourceContainer || !this.authoredSourceTexture) return;
    this.renderer.render({
      container: this.authoredSourceContainer,
      target: this.authoredSourceTexture,
      transform: this.authoredSourcePlacement,
      clear: true,
      clearColor: [0, 0, 0, 0]
    });
  }

  moveTo(localX, localY) {
    this.targetPosition.x = localX;
    this.targetPosition.y = localY;
    this.isMovingToTarget = true;
  }

  updateWarpPointer(dtSeconds, config, runtimePointer) {
    const pointer = this.warpPointer;
    const canTransformPointer = runtimePointer.available &&
      runtimePointer.absolute &&
      Math.abs(this.currentFlipScale) > 0.05;
    let targetActive = 0.0;

    if (canTransformPointer) {
      const local = this.visualContainer.toLocal(runtimePointer.absolute);
      const width = Math.max(this.warpTextureSize.width, 1);
      const height = Math.max(this.warpTextureSize.height, 1);
      const nextX = local.x / width + 0.5;
      const nextY = local.y / height + 0.5;
      targetActive = nextX >= 0.0 && nextX <= 1.0 && nextY >= 0.0 && nextY <= 1.0
        ? 1.0
        : 0.0;

      if (pointer.initialized && dtSeconds > 0.0001) {
        const maxVelocity = 12.0;
        const rawVelocityX = Math.max(-maxVelocity, Math.min(maxVelocity, (nextX - pointer.position[0]) / dtSeconds));
        const rawVelocityY = Math.max(-maxVelocity, Math.min(maxVelocity, (nextY - pointer.position[1]) / dtSeconds));
        const velocityBlend = 1.0 - Math.exp(-dtSeconds * 12.0);
        pointer.velocity[0] += (rawVelocityX - pointer.velocity[0]) * velocityBlend;
        pointer.velocity[1] += (rawVelocityY - pointer.velocity[1]) * velocityBlend;
      } else {
        pointer.velocity[0] = 0.0;
        pointer.velocity[1] = 0.0;
        pointer.initialized = true;
      }

      pointer.position[0] = Math.max(-1.0, Math.min(2.0, nextX));
      pointer.position[1] = Math.max(-1.0, Math.min(2.0, nextY));
    } else {
      const velocityDecay = Math.exp(-dtSeconds * 10.0);
      pointer.velocity[0] *= velocityDecay;
      pointer.velocity[1] *= velocityDecay;
    }

    if (config.mode !== 'organic' || config.cursorInfluence <= 0.0) {
      targetActive = 0.0;
    }
    const activeBlend = 1.0 - Math.exp(-dtSeconds * 10.0);
    pointer.active += (targetActive - pointer.active) * activeBlend;
  }

  updateMutation(dtSeconds, config) {
    if (config.autoRotate) {
      const direction = config.rotationDirection === 'counterclockwise' ? -1 : 1;
      this.autoRotationDegrees += dtSeconds * config.rotationSpeed * direction;
      if (Math.abs(this.autoRotationDegrees) > 36000) this.autoRotationDegrees %= 360;
    }
    const mode = MUTATION_MODE_VALUES[config.mode] ?? 0;
    const sourceX = config.sourceX === 'right' ? 1.0 : 0.0;
    const sourceY = config.sourceY === 'bottom' ? 1.0 : 0.0;

    const effectiveRotation = (config.rotation + this.autoRotationDegrees) * (Math.PI / 180);
    const applyGeometryUniforms = (uniforms) => {
      uniforms.uMode = mode;
      uniforms.uAxisX = config.axisX;
      uniforms.uAxisY = config.axisY;
      uniforms.uSourceX = sourceX;
      uniforms.uSourceY = sourceY;
      uniforms.uSourceRotation = effectiveRotation;
    };

    if (this.actorMutationMesh) {
      applyGeometryUniforms(this.actorMutationMesh.shader.resources.mutationUniforms.uniforms);
    }

  }

  update(deltaTime, actorConfig, phenomena, runtime, dynamics) {
    const dtSeconds = deltaTime / 60;

    if (this.isMovingToTarget) {
      const dx = this.targetPosition.x - this.baselinePosition.x;
      const dy = this.targetPosition.y - this.baselinePosition.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 15) {
        this.isMovingToTarget = false;
      } else {
        this.baselinePosition.x += dx * 0.0071 * deltaTime;
        this.baselinePosition.y += dy * 0.0071 * deltaTime;
        this.facingDirection = dx > 0 ? 1.0 : -1.0;
      }
    }

    this.currentFlipScale += (this.facingDirection - this.currentFlipScale) * 0.2 * deltaTime;

    const headState = this.flightDynamics.calculate(
      runtime.elapsed,
      actorConfig.motion,
      dynamics.glitchShakeIntensity,
      dynamics.isGlitchActive,
      this.baselinePosition,
      this.currentFlipScale,
      dynamics.canvasHeight
    );

    this.headState = headState;

    this.container.position.set(headState.x, headState.y);
    this.container.scale.set(
      headState.scale * this.baseActorScale,
      headState.scale * this.baseActorScale
    );
    this.container.rotation = 0;
    this.visualContainer.scale.set(this.currentFlipScale, 1);
    this.visualContainer.rotation = headState.rotation;

    this.updateWarpPointer(dtSeconds, actorConfig.warp, runtime.pointer);
    this.updateMutation(dtSeconds, actorConfig.geometry);
    this.veinPulseSystem?.update(runtime.elapsed, phenomena.veins, runtime.reactionModifiers);
    this.captiveWeatherSystem?.update(runtime.elapsed, phenomena.weather, runtime.reactionModifiers);
    if (this.eyeSystem) {
      this.eyeSystem.update(deltaTime, actorConfig.eyes, runtime);
    }
    this.renderAuthoredMutationSource();
  }

  getEffectsTargets() {
    return {
      headContainer: this.visualContainer,
      auraSprite: this.layers.aura || null,
      baseSprite: this.layers.base || null
    };
  }

  getTrailRenderTransformSnapshot() {
    return createTrailRenderTransformSnapshot(this.container, this.visualContainer);
  }

  destroy() {
    if (this.characterContentContainer) {
      this.characterContentContainer.mask = null;
      this.characterContentContainer = null;
    }
    if (this.eyeSystem?.destroy) {
      this.eyeSystem.destroy();
    }
    if (this.actorMutationMesh) {
      this.actorMutationMesh.shader.destroy();
      this.actorMutationMesh.geometry.destroy();
      this.actorMutationMesh = null;
    }
    if (this.authoredSourceTexture) {
      this.authoredSourceTexture.destroy(true);
      this.authoredSourceTexture = null;
    }
    if (this.authoredSourceContainer) {
      this.authoredSourceContainer.destroy({ children: true });
      this.authoredSourceContainer = null;
    }
    this.veinPulseSystem?.destroy();
    this.captiveWeatherSystem?.destroy();
    this.veinPulseSystem = null;
    this.captiveWeatherSystem = null;
    for (const phenomenon of this.phenomenaMeshes) {
      phenomenon.shader.destroy();
      phenomenon.geometry.destroy();
    }
    this.phenomenaMeshes = [];
    this.renderer = null;
    this.container.destroy({ children: true });
  }
}
