// src/engine/entities/ActorEntity.js
import { Assets, Container, Graphics, Matrix, RenderTexture, Sprite } from 'pixi.js';
import { EyeSystem } from '../systems/EyeSystem.js';
import { FlightDynamics } from '../systems/FlightDynamics.js';
import { createMutationMesh } from './MutationMeshFactory.js';
import { CreatorEyeSystem } from '../systems/CreatorEyeSystem.js';
import { createCaptiveWeatherOverlay, createVeinPulseOverlay } from './CharacterPhenomenaMeshFactory.js';
import { VeinPulseSystem } from '../systems/VeinPulseSystem.js';
import { CaptiveWeatherSystem } from '../systems/CaptiveWeatherSystem.js';
import { createPatternTransfusionFilter } from '../filters/PatternTransfusionFilterFactory.js';
import { createActorMutationMesh } from './ActorMutationMeshFactory.js';

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
    this.time = 0;

    this.flightDynamics = new FlightDynamics();
    this.eyeSystem = null;
    this.creatorEyeSystem = null;
    this.layers = {};
    this.mutationMeshes = [];
    this.phenomenaMeshes = [];
    this.veinPulseSystem = null;
    this.captiveWeatherSystem = null;
    this.patternTransfusionFilter = null;
    this.isCreatorRig = assets.isCreatorRig === true;
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

    const createCreatorAura = () => {
      const aura = new Graphics();

      // A soft camera-facing field reads as emitted light without duplicating
      // or exposing the mutated silhouette while the artwork tilts and flips.
      for (let ring = 12; ring >= 1; ring -= 1) {
        const progress = (13 - ring) / 12;
        const radiusX = 430 + ring * 36;
        const radiusY = 350 + ring * 30;
        const alpha = 0.015 + progress * progress * 0.16;
        aura.ellipse(0, 0, radiusX, radiusY).fill({ color: 0xffffff, alpha });
      }

      return aura;
    };

    const maskTexture = this.assets.char_clipping_mask
      ? Assets.get(this.assets.char_clipping_mask)
      : null;
    if (maskTexture?.width && maskTexture?.height) {
      this.warpTextureSize.width = maskTexture.width;
      this.warpTextureSize.height = maskTexture.height;
    }

    if (!this.isCreatorRig) {
      this.authoredSourceContainer = new Container();
      this.authoredSourceContainer.label = `actor_source_${this.id}`;
    }

    if (this.assets.char_clipping_mask && !this.isCreatorRig) {
      this.layers.aura = createSprite(this.assets.char_clipping_mask);
      this.container.addChild(this.layers.aura);
    } else if (this.assets.char_clipping_mask) {
      this.layers.aura = createCreatorAura();
      this.container.addChild(this.layers.aura);
    }

    this.container.addChild(this.visualContainer);

    if (this.assets.char_clipping_mask && !this.isCreatorRig) {
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
    } else if (this.assets.char_clipping_mask) {
      const textures = {
        mask: Assets.get(this.assets.char_clipping_mask),
        lineart: Assets.get(this.assets.char_lineart),
        pattern1: Assets.get(this.assets.creator_pattern),
        pattern2: Assets.get(this.assets.creator_pattern_2),
        baseA: Assets.get(this.assets.creator_base_a),
        baseB: Assets.get(this.assets.creator_base_b),
        pattern1A: Assets.get(this.assets.creator_pattern_1_a),
        pattern1B: Assets.get(this.assets.creator_pattern_1_b),
        pattern2A: Assets.get(this.assets.creator_pattern_2_a),
        pattern2B: Assets.get(this.assets.creator_pattern_2_b)
      };

      const bodyMutation = createMutationMesh(textures);
      this.mutationMeshes.push(bodyMutation);
      this.layers.mutationBody = bodyMutation.mesh;
      this.visualContainer.addChild(this.layers.mutationBody);
      this.captiveWeatherSystem = new CaptiveWeatherSystem(this.mutationMeshes);
      this.veinPulseSystem = new VeinPulseSystem(this.mutationMeshes);
      this.creatorEyeSystem = new CreatorEyeSystem(this.visualContainer, {
        white: this.assets.creator_eye_white,
        irisMask: this.assets.creator_eye_iris_mask,
        pupil: this.assets.creator_eye_pupil,
        glint: this.assets.creator_eye_glint,
        lidTop: this.assets.creator_eye_lid_top,
        lidBottom: this.assets.creator_eye_lid_bottom
      });
    }

    if (
      this.characterContentContainer &&
      !this.isCreatorRig &&
      this.assets.discoveredPatterns &&
      this.assets.discoveredPatterns.length > 0 &&
      this.renderTextureManager
    ) {
      const patternSprite = new Sprite(this.renderTextureManager.patternRenderTexture);
      patternSprite.anchor.set(0.5);
      this.layers.pattern = patternSprite;
      this.characterContentContainer.addChild(patternSprite);
      this.patternTransfusionFilter = createPatternTransfusionFilter();
      patternSprite.filters = [this.patternTransfusionFilter];
    }

    if (this.assets.char_lineart && !this.isCreatorRig) {
      this.layers.lineart = createSprite(this.assets.char_lineart);
      this.authoredSourceContainer.addChild(this.layers.lineart);
    }

    if (this.assets.discoveredEyes && this.assets.discoveredEyes.length > 0) {
      this.eyeSystem = new EyeSystem(this.isCreatorRig ? this.visualContainer : this.authoredSourceContainer, {
        discoveredEyes: this.assets.discoveredEyes,
        hasEyelids: !!this.assets.eyelids_top,
        eyelidsTopAlias: this.assets.eyelids_top || null,
        eyelidsBottomAlias: this.assets.eyelids_bottom || null
      });
    }

    if (!this.isCreatorRig && maskTexture?.width && maskTexture?.height) {
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

  updateWarpPointer(dtSeconds, config) {
    const pointer = this.warpPointer;
    const canTransformPointer = config.hasMousePosition === true &&
      config.absoluteMousePos &&
      Math.abs(this.currentFlipScale) > 0.05;
    let targetActive = 0.0;

    if (canTransformPointer) {
      const local = this.visualContainer.toLocal(config.absoluteMousePos);
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

    if (config.warpMode !== 'organic' || (config.warpCursorInfluence ?? 0.45) <= 0.0) {
      targetActive = 0.0;
    }
    const activeBlend = 1.0 - Math.exp(-dtSeconds * 10.0);
    pointer.active += (targetActive - pointer.active) * activeBlend;
  }

  updateMutation(dtSeconds, config) {
    if (config.mutationAutoRotate === true) {
      const direction = config.mutationRotationDirection === 'counterclockwise' ? -1 : 1;
      this.autoRotationDegrees += dtSeconds * Math.max(0, config.mutationRotationSpeed ?? 12) * direction;
      if (Math.abs(this.autoRotationDegrees) > 36000) this.autoRotationDegrees %= 360;
    }
    const mode = MUTATION_MODE_VALUES[config.mutationMode] ?? 0;
    const axisX = Math.max(0.01, Math.min(0.99, config.mutationAxisX ?? 0.5));
    const axisY = Math.max(0.01, Math.min(0.99, config.mutationAxisY ?? 0.5));
    const sourceX = config.mutationSourceX === 'right' ? 1.0 : 0.0;
    const sourceY = config.mutationSourceY === 'bottom' ? 1.0 : 0.0;

    const effectiveRotation = ((config.mutationRotation ?? 0) + this.autoRotationDegrees) * (Math.PI / 180);
    const applyGeometryUniforms = (uniforms) => {
      uniforms.uMode = mode;
      uniforms.uAxisX = axisX;
      uniforms.uAxisY = axisY;
      uniforms.uSourceX = sourceX;
      uniforms.uSourceY = sourceY;
      uniforms.uSourceRotation = effectiveRotation;
    };

    if (this.actorMutationMesh) {
      applyGeometryUniforms(this.actorMutationMesh.shader.resources.mutationUniforms.uniforms);
    }

    for (const mutationMesh of this.mutationMeshes) {
      const uniforms = mutationMesh.shader.resources.mutationUniforms.uniforms;
      applyGeometryUniforms(uniforms);
      uniforms.uMirrorPattern = mode !== 0 && config.mutationPatternMode === 'mirrored' ? 1.0 : 0.0;
      uniforms.uTime = this.time * (config.warpSpeed ?? 1);
      uniforms.uWarpIntensity = config.warpIntensity ?? 20;
      uniforms.uWarpMode = config.warpMode === 'organic' ? 1.0 : 0.0;
      uniforms.uMorphRange = config.warpOrganicRange ?? 1.0;
      uniforms.uLayerDivergence = config.warpLayerDivergence ?? 0.3;
      uniforms.uCursorPosition = this.warpPointer.position;
      uniforms.uCursorVelocity = this.warpPointer.velocity;
      uniforms.uCursorActive = this.warpPointer.active;
      uniforms.uCursorInfluence = config.warpCursorInfluence ?? 0.45;
      uniforms.uCursorRadius = config.warpCursorRadius ?? 0.22;
      uniforms.uBaseGradientMode = config.creatorBaseColorMode === 'gradient' ? 1.0 : 0.0;
      uniforms.uBaseGradientAngle = (config.creatorBaseGradientAngle ?? 0) * (Math.PI / 180);
      uniforms.uBaseGradientBalance = config.creatorBaseGradientBalance ?? 0.5;
      uniforms.uBaseOpacity = config.creatorBaseOpacity ?? 1;
      uniforms.uPattern1GradientMode = config.creatorPattern1ColorMode === 'gradient' ? 1.0 : 0.0;
      uniforms.uPattern1GradientAngle = (config.creatorPattern1GradientAngle ?? 0) * (Math.PI / 180);
      uniforms.uPattern1GradientBalance = config.creatorPattern1GradientBalance ?? 0.5;
      uniforms.uPattern1Opacity = config.creatorPattern1Opacity ?? 1;
      uniforms.uPattern1Scale = config.creatorPattern1Scale ?? 1;
      uniforms.uPattern2GradientMode = config.creatorPattern2ColorMode === 'gradient' ? 1.0 : 0.0;
      uniforms.uPattern2GradientAngle = (config.creatorPattern2GradientAngle ?? 0) * (Math.PI / 180);
      uniforms.uPattern2GradientBalance = config.creatorPattern2GradientBalance ?? 0.5;
      uniforms.uPattern2Opacity = config.creatorPattern2Opacity ?? 0;
      uniforms.uPattern2Scale = config.creatorPattern2Scale ?? 1;
      uniforms.uNoiseIntensity = config.creatorNoiseIntensity ?? 0;
      uniforms.uNoiseScale = config.creatorNoiseScale ?? 180;
      uniforms.uTransfusionEnabled = config.transfusionEnabled === false ? 0.0 : 1.0;
      uniforms.uTransfusionTime = this.time;
      uniforms.uTransfusionIntensity = config.transfusionIntensity ?? 0.78;
      uniforms.uTransfusionScale = config.transfusionScale ?? 3.4;
      uniforms.uTransfusionBalance = config.transfusionBalance ?? 0.5;
      uniforms.uTransfusionEdge = config.transfusionEdge ?? 0.38;
    }
  }

  update(deltaTime, config, isGlitchActive, canvasHeight) {
    const dtSeconds = deltaTime / 60;
    this.time += dtSeconds;

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
      this.time,
      config,
      isGlitchActive,
      this.baselinePosition,
      this.currentFlipScale,
      canvasHeight
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

    this.updateWarpPointer(dtSeconds, config);
    this.updateMutation(dtSeconds, config);
    this.veinPulseSystem?.update(this.time, config);
    this.captiveWeatherSystem?.update(this.time, config);
    if (this.patternTransfusionFilter) {
      const uniforms = this.patternTransfusionFilter.resources.transfusionUniforms.uniforms;
      uniforms.uEnabled = config.transfusionEnabled === false ? 0.0 : 1.0;
      uniforms.uTime = this.time;
      uniforms.uIntensity = config.transfusionIntensity ?? 0.78;
      uniforms.uScale = config.transfusionScale ?? 3.4;
      uniforms.uBalance = config.transfusionBalance ?? 0.5;
      uniforms.uEdge = config.transfusionEdge ?? 0.38;
    }
    if (this.creatorEyeSystem) {
      this.creatorEyeSystem.update(config, this.time);
    }

    if (this.eyeSystem) {
      this.eyeSystem.update(deltaTime, config);
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

  destroy() {
    if (this.characterContentContainer) {
      this.characterContentContainer.mask = null;
      this.characterContentContainer = null;
    }
    if (this.eyeSystem?.destroy) {
      this.eyeSystem.destroy();
    }
    if (this.creatorEyeSystem) {
      this.creatorEyeSystem.destroy();
      this.creatorEyeSystem = null;
    }
    for (const mutationMesh of this.mutationMeshes) {
      mutationMesh.shader.destroy();
      mutationMesh.geometry.destroy();
    }
    this.mutationMeshes = [];
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
    this.patternTransfusionFilter?.destroy();
    this.patternTransfusionFilter = null;
    this.renderer = null;
    this.container.destroy({ children: true });
  }
}
