import { Assets, Container, Matrix, RenderTexture, Sprite, Texture } from 'pixi.js';
import { createShedSkinTrailFilter } from '../filters/ShedSkinTrailFilterFactory.js';

const MAX_SNAPSHOTS = 8;
const CAPTURE_SCALE = 0.5;
const CAPTURE_PADDING = 1.3;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Freezes the complete live character pass in world space at regular movement
// intervals. This is deliberately separate from the RGB reaction echoes.
export class ShedSkinTrailSystem {
  constructor(parentContainer, renderer, actor, textureAlias) {
    this.parentContainer = parentContainer;
    this.renderer = renderer;
    this.actor = actor;
    this.container = new Container();
    this.container.label = 'shed_skin_snapshots';
    parentContainer.addChildAt(this.container, parentContainer.getChildIndex(actor.container));

    this.snapshots = [];
    this.cursor = 0;
    this.frameAccumulator = 0;
    this.previousPosition = null;
    this.velocity = { x: 0, y: 0 };
    this.speed = 0;
    this.time = 0;

    const sourceTexture = textureAlias ? Assets.get(textureAlias) : Texture.EMPTY;
    const sourceWidth = sourceTexture && sourceTexture !== Texture.EMPTY ? sourceTexture.width : 2000;
    const sourceHeight = sourceTexture && sourceTexture !== Texture.EMPTY ? sourceTexture.height : 2000;
    this.captureWidth = Math.max(64, Math.ceil(sourceWidth * CAPTURE_SCALE * CAPTURE_PADDING));
    this.captureHeight = Math.max(64, Math.ceil(sourceHeight * CAPTURE_SCALE * CAPTURE_PADDING));
    this.capturePlacement = new Matrix(
      CAPTURE_SCALE, 0,
      0, CAPTURE_SCALE,
      this.captureWidth / 2,
      this.captureHeight / 2
    );

    for (let index = 0; index < MAX_SNAPSHOTS; index += 1) {
      const texture = RenderTexture.create({
        width: this.captureWidth,
        height: this.captureHeight,
        resolution: 1
      });
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      sprite.alpha = 0;
      sprite.blendMode = 'normal';
      sprite.filters = [createShedSkinTrailFilter()];
      this.container.addChild(sprite);
      this.snapshots.push({
        sprite,
        texture,
        active: false,
        bornAt: 0,
        baseScale: 1,
        direction: { x: 1, y: 0 }
      });
    }
  }

  capture(headState, count) {
    if (!this.renderer || !this.actor?.visualContainer || count <= 0) return;
    const slotIndex = this.cursor % count;
    this.cursor = (this.cursor + 1) % count;
    const snapshot = this.snapshots[slotIndex];
    const visual = this.actor.visualContainer;

    visual.updateLocalTransform();
    const captureTransform = visual.localTransform.clone().prepend(this.capturePlacement);
    this.renderer.render({
      container: visual,
      target: snapshot.texture,
      transform: captureTransform,
      clear: true,
      clearColor: [0, 0, 0, 0]
    });

    const directionLength = Math.max(0.0001, Math.hypot(this.velocity.x, this.velocity.y));
    snapshot.direction.x = this.velocity.x / directionLength;
    snapshot.direction.y = this.velocity.y / directionLength;
    snapshot.bornAt = this.time;
    snapshot.baseScale = headState.scale;
    snapshot.active = true;
    snapshot.sprite.visible = true;
    snapshot.sprite.alpha = 0;
    snapshot.sprite.position.set(headState.x, headState.y);
    // Flip and rotation are already baked into this render.
    snapshot.sprite.scale.set(headState.scale);
    snapshot.sprite.rotation = 0;
  }

  update(deltaTime, headState, config) {
    const dt = Math.min(0.05, deltaTime / 60);
    this.time += dt;
    this.frameAccumulator += deltaTime;

    const previous = this.previousPosition ?? headState;
    const frameScale = 1 / Math.max(0.25, deltaTime);
    const rawVx = (headState.x - previous.x) * frameScale;
    const rawVy = (headState.y - previous.y) * frameScale;
    this.previousPosition = { x: headState.x, y: headState.y };
    const velocityEase = 1 - Math.exp(-dt * 14);
    this.velocity.x += (rawVx - this.velocity.x) * velocityEase;
    this.velocity.y += (rawVy - this.velocity.y) * velocityEase;
    const rawSpeed = Math.hypot(this.velocity.x, this.velocity.y);
    const speedEase = 1 - Math.exp(-dt * (rawSpeed > this.speed ? 18 : 6));
    this.speed += (rawSpeed - this.speed) * speedEase;

    const count = clamp(config.count, 0, MAX_SNAPSHOTS);
    const spacing = config.spacing;
    const enabled = config.enabled && count > 0;
    const threshold = config.motionThreshold;
    const fullSpeed = Math.max(threshold + 0.01, config.fullSpeed);
    const normalizedSpeed = clamp((this.speed - threshold) / (fullSpeed - threshold), 0, 1);
    const motion = normalizedSpeed * normalizedSpeed * (3 - 2 * normalizedSpeed);

    if (enabled && motion > 0.01 && this.frameAccumulator >= spacing) {
      this.frameAccumulator %= spacing;
      this.capture(headState, count);
    }

    const lifetime = config.lifetime;
    const opacity = config.opacity;
    const fadePower = config.fade;
    const backslide = config.backslide;
    const drift = config.drift;
    const expansion = config.expansion;
    const dissolve = config.dissolve;
    const tintStrength = config.colorMix;
    const color = config.color.map((value) => value / 255);

    this.snapshots.forEach((snapshot, index) => {
      const { sprite } = snapshot;
      if (!snapshot.active || !enabled || index >= count) {
        snapshot.active = false;
        sprite.visible = false;
        sprite.alpha = 0;
        return;
      }

      const progress = clamp((this.time - snapshot.bornAt) / lifetime, 0, 1);
      if (progress >= 1) {
        snapshot.active = false;
        sprite.visible = false;
        sprite.alpha = 0;
        return;
      }

      const filter = sprite.filters?.[0];
      if (filter?.resources?.shedSkinUniforms) {
        const uniforms = filter.resources.shedSkinUniforms.uniforms;
        uniforms.uProgress = progress;
        uniforms.uTime = this.time;
        uniforms.uDissolve = dissolve;
        uniforms.uDirection = [snapshot.direction.x, snapshot.direction.y];
        uniforms.uTint = color;
        uniforms.uTintStrength = tintStrength;
      }

      const fade = Math.pow(1 - progress, fadePower);
      const grow = 1 + progress * expansion;
      sprite.position.x -= snapshot.direction.x * backslide * dt;
      sprite.position.y -= snapshot.direction.y * backslide * dt + drift * dt;
      sprite.scale.set(snapshot.baseScale * grow);
      sprite.alpha = opacity * fade;
    });
  }

  destroy() {
    for (const snapshot of this.snapshots) {
      snapshot.sprite.filters?.forEach((filter) => filter.destroy());
      snapshot.sprite.filters = null;
      snapshot.texture.destroy(true);
    }
    this.snapshots = [];
    if (this.container?.parent) this.container.parent.removeChild(this.container);
    this.container?.destroy({ children: true });
    this.container = null;
    this.renderer = null;
    this.actor = null;
  }
}
