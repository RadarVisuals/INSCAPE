// src/engine/entities/ActorEntity.js
import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import { EyeSystem } from '../systems/EyeSystem.js';
import { FlightDynamics } from '../systems/FlightDynamics.js';
import { createMutationMesh } from './MutationMeshFactory.js';

const MUTATION_MODE_VALUES = {
  none: 0,
  mirrorX: 1,
  mirrorY: 2,
  quad: 3
};

export class ActorEntity {
  constructor(id, assets, renderTextureManager) {
    this.id = id;
    this.assets = assets;
    this.renderTextureManager = renderTextureManager;

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
    this.layers = {};
    this.mutationMeshes = [];
    this.mutationEnabled = assets.isCreatorRig === true;
    this.headState = { x: 0, y: 0, scale: 1, scaleX: 1, rotation: 0 };
    
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

    if (this.assets.char_clipping_mask && !this.mutationEnabled) {
      this.layers.aura = createSprite(this.assets.char_clipping_mask);
      this.container.addChild(this.layers.aura);
    } else if (this.assets.char_clipping_mask) {
      this.layers.aura = createCreatorAura();
      this.container.addChild(this.layers.aura);
    }

    this.container.addChild(this.visualContainer);

    if (this.assets.char_clipping_mask && !this.mutationEnabled) {
      const charMaskSprite = createSprite(this.assets.char_clipping_mask);
      this.layers.mask = charMaskSprite;
      this.visualContainer.addChild(charMaskSprite);

      this.characterContentContainer = new Container();
      
      // Standard native mask assignment with explicit alpha channel decoding.
      // PixiJS v8 default sprite mask behavior samples the red channel (great for grayscale, 
      // but fails if the mask uses high alpha transparency with negligible red values).
      this.characterContentContainer.setMask({
        mask: charMaskSprite,
        channel: 'alpha'
      });
      this.visualContainer.addChild(this.characterContentContainer);

      this.layers.base = createSprite(this.assets.char_base || this.assets.char_clipping_mask);
      this.characterContentContainer.addChild(this.layers.base);
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
    }

    if (
      this.characterContentContainer &&
      !this.mutationEnabled &&
      this.assets.discoveredPatterns &&
      this.assets.discoveredPatterns.length > 0 &&
      this.renderTextureManager
    ) {
      const patternSprite = new Sprite(this.renderTextureManager.patternRenderTexture);
      patternSprite.anchor.set(0.5);
      this.layers.pattern = patternSprite;
      this.characterContentContainer.addChild(patternSprite);
    }

    if (this.assets.char_lineart && !this.mutationEnabled) {
      this.layers.lineart = createSprite(this.assets.char_lineart);
      this.visualContainer.addChild(this.layers.lineart);
    }

    if (this.assets.discoveredEyes && this.assets.discoveredEyes.length > 0) {
      this.eyeSystem = new EyeSystem(this.visualContainer, {
        discoveredEyes: this.assets.discoveredEyes,
        hasEyelids: !!this.assets.eyelids_top,
        eyelidsTopAlias: this.assets.eyelids_top || null,
        eyelidsBottomAlias: this.assets.eyelids_bottom || null
      });
    }
  }

  moveTo(localX, localY) {
    this.targetPosition.x = localX;
    this.targetPosition.y = localY;
    this.isMovingToTarget = true;
  }

  updateMutation(config) {
    if (!this.mutationEnabled) return;

    const mode = MUTATION_MODE_VALUES[config.mutationMode] ?? 0;
    const axisX = Math.max(0.01, Math.min(0.99, config.mutationAxisX ?? 0.5));
    const axisY = Math.max(0.01, Math.min(0.99, config.mutationAxisY ?? 0.5));
    const sourceX = config.mutationSourceX === 'right' ? 1.0 : 0.0;
    const sourceY = config.mutationSourceY === 'bottom' ? 1.0 : 0.0;

    for (const mutationMesh of this.mutationMeshes) {
      const uniforms = mutationMesh.shader.resources.mutationUniforms.uniforms;
      uniforms.uMode = mode;
      uniforms.uAxisX = axisX;
      uniforms.uAxisY = axisY;
      uniforms.uSourceX = sourceX;
      uniforms.uSourceY = sourceY;
      uniforms.uMirrorPattern = mode !== 0 && config.mutationPatternMode === 'mirrored' ? 1.0 : 0.0;
      uniforms.uSourceRotation = (config.mutationRotation ?? 0) * (Math.PI / 180);
      uniforms.uTime = this.time * (config.warpSpeed ?? 1);
      uniforms.uWarpIntensity = config.warpIntensity ?? 20;
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

    this.updateMutation(config);

    if (this.eyeSystem) {
      this.eyeSystem.update(deltaTime, config);
    }
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
    for (const mutationMesh of this.mutationMeshes) {
      mutationMesh.shader.destroy();
      mutationMesh.geometry.destroy();
    }
    this.mutationMeshes = [];
    this.container.destroy({ children: true });
  }
}
