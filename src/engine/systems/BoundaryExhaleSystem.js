import { Assets, Container, Graphics, Texture } from 'pixi.js';

function rgbTint(config) {
  const r = Math.max(0, Math.min(255, Math.round(config.weatherColorR ?? 42)));
  const g = Math.max(0, Math.min(255, Math.round(config.weatherColorG ?? 5)));
  const b = Math.max(0, Math.min(255, Math.round(config.weatherColorB ?? 72)));
  return (r << 16) | (g << 8) | b;
}

function smoothstep(min, max, value) {
  const t = Math.max(0, Math.min(1, (value - min) / Math.max(0.0001, max - min)));
  return t * t * (3 - 2 * t);
}

function ribbonPath(graphics, points, widths, color, alpha) {
  if (points.length < 2 || alpha <= 0.001) return;
  const left = [];
  const right = [];

  for (let index = 0; index < points.length; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    const nx = -dy / length;
    const ny = dx / length;
    left.push({ x: points[index].x + nx * widths[index], y: points[index].y + ny * widths[index] });
    right.push({ x: points[index].x - nx * widths[index], y: points[index].y - ny * widths[index] });
  }

  graphics.moveTo(left[0].x, left[0].y);
  for (let index = 1; index < left.length; index += 1) graphics.lineTo(left[index].x, left[index].y);
  for (let index = right.length - 1; index >= 0; index -= 1) graphics.lineTo(right[index].x, right[index].y);
  graphics.closePath().fill({ color, alpha });
}

// Hard-edged tendril limbs rooted to the live silhouette. Nothing is blurred
// and nothing is launched as an independent cloud sprite.
export class BoundaryExhaleSystem {
  constructor(parentContainer, renderer, actor) {
    this.parentContainer = parentContainer;
    this.renderer = renderer;
    this.actor = actor;
    this.container = new Container();
    this.container.label = 'silhouette_tendril_limbs';
    parentContainer.addChildAt(this.container, parentContainer.getChildIndex(actor.container));
    this.wisps = [];
    this.edgePoints = this.extractBoundaryPoints();
    this.time = 0;
    this.lastActorPosition = { x: actor.container.x, y: actor.container.y };
    this.smoothedVelocity = { x: 0, y: 0 };
    this.sharedDirection = { x: -actor.facingDirection, y: 0.12 };
  }

  extractBoundaryPoints() {
    const alias = this.actor.assets.char_clipping_mask;
    const maskTexture = alias ? Assets.get(alias) : Texture.EMPTY;
    if (!maskTexture || maskTexture === Texture.EMPTY) return [];

    try {
      const { pixels, width, height } = this.renderer.extract.pixels(maskTexture);
      const points = [];
      const step = 12;
      const logicalWidth = maskTexture.width || width;
      const logicalHeight = maskTexture.height || height;
      const alphaAt = (x, y) => pixels[(y * width + x) * 4 + 3];

      for (let y = step; y < height - step; y += step) {
        for (let x = step; x < width - step; x += step) {
          const inside = alphaAt(x, y);
          if (inside <= 110) continue;
          // Pixi's extract system returns display-oriented rows; unlike raw
          // WebGL readPixels, row zero is already the visual top edge.
          const above = alphaAt(x, y - step);
          const below = alphaAt(x, y + step);
          const left = alphaAt(x - step, y);
          const right = alphaAt(x + step, y);
          if (Math.min(above, below, left, right) >= 28) continue;

          // The alpha gradient points inward. Negating it produces a local
          // outward normal in the same top-down coordinate space used by the
          // centered actor sprite. Downward-facing roots are omitted so limbs
          // frame rather than dangle below the character.
          let nx = left - right;
          let ny = above - below;
          const normalLength = Math.max(0.001, Math.hypot(nx, ny));
          nx /= normalLength;
          ny /= normalLength;
          if (ny <= 0.55) {
            points.push({
              x: (x / width - 0.5) * logicalWidth,
              y: (y / height - 0.5) * logicalHeight,
              ux: x / width - 0.5,
              uy: y / height - 0.5,
              nx,
              ny
            });
          }
        }
      }
      return points;
    } catch (error) {
      console.warn('[BoundaryExhaleSystem] Could not sample actor mask edges:', error);
      return [];
    }
  }

  selectAnchors(count) {
    if (count <= 0 || this.edgePoints.length === 0) return [];
    const anchors = [];
    const startAngle = -2.86;
    const endAngle = -0.28;

    for (let index = 0; index < count; index += 1) {
      const targetAngle = count === 1
        ? -Math.PI / 2
        : startAngle + (endAngle - startAngle) * (index / (count - 1));
      let best = null;
      let bestScore = Infinity;

      for (const edge of this.edgePoints) {
        if (anchors.includes(edge)) continue;
        const angle = Math.atan2(edge.uy, edge.ux);
        const angularDistance = Math.atan2(Math.sin(angle - targetAngle), Math.cos(angle - targetAngle));
        const radius = Math.hypot(edge.ux, edge.uy);
        // Prefer the nearest main-body boundary within each angular sector,
        // avoiding remote horn tips and making attachment sites deterministic.
        const score = angularDistance * angularDistance * 18 + radius * 0.22;
        if (score < bestScore) {
          bestScore = score;
          best = edge;
        }
      }
      if (best) anchors.push(best);
    }
    return anchors;
  }

  syncFollicles(count) {
    if (this.wisps.length === count) return;
    for (const wisp of this.wisps) {
      if (wisp.graphics.parent) wisp.graphics.parent.removeChild(wisp.graphics);
      wisp.graphics.destroy();
    }
    this.wisps = [];

    const anchors = this.selectAnchors(count);
    for (let index = 0; index < anchors.length; index += 1) {
      const graphics = new Graphics();
      this.container.addChild(graphics);
      this.wisps.push({
        graphics,
        edge: anchors[index],
        phaseOffset: (index - (anchors.length - 1) * 0.5) * 0.34,
        lengthFactor: 0.88 + ((index * 37) % 5) * 0.045,
        widthFactor: 0.9 + ((index * 23) % 4) * 0.055,
        direction: null
      });
    }
  }

  actorRootAndDirection(edge) {
    const rootGlobal = this.actor.visualContainer.toGlobal(edge);
    const normalGlobal = this.actor.visualContainer.toGlobal({
      x: edge.x + edge.nx * 100,
      y: edge.y + edge.ny * 100
    });
    const root = this.parentContainer.toLocal(rootGlobal);
    const normalPoint = this.parentContainer.toLocal(normalGlobal);
    const dx = normalPoint.x - root.x;
    const dy = normalPoint.y - root.y;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    return {
      root,
      normal: { x: dx / length, y: dy / length },
      tangent: { x: -dy / length, y: dx / length }
    };
  }

  drawWisp(wisp, config, dt) {
    const amount = Math.max(0, Math.min(1, config.tendrilAmount ?? config.weatherLeak ?? 0));
    const pulseStrength = Math.max(0, Math.min(0.45, config.tendrilPulse ?? 0.1));
    const colonyPulse = Math.sin(this.time * 0.52 + wisp.phaseOffset * 0.22);
    const extension = smoothstep(0, 0.22, amount) * (0.92 + colonyPulse * pulseStrength);
    const opacity = smoothstep(0, 0.16, amount) * (0.38 + amount * 0.5);
    const configuredLength = (config.tendrilLength ?? config.weatherEscapeLength ?? 190) * wisp.lengthFactor;
    const wave = Math.max(0, Math.min(5, config.tendrilWave ?? config.weatherTrail ?? 0.85));
    const waveRepeats = Math.max(0.5, Math.min(8, config.tendrilWaveRepeats ?? 2.5));
    const waveSpeed = Math.max(0, config.tendrilSpeed ?? 0.35);
    const widthScale = Math.max(0.15, config.tendrilWidth ?? 1) * wisp.widthFactor;
    const alignment = Math.max(0, Math.min(1, config.tendrilAlignment ?? 0.82));
    const turnSpeed = Math.max(0.5, config.tendrilTurnSpeed ?? 4);
    const { root, normal } = this.actorRootAndDirection(wisp.edge);
    const desiredX = normal.x * (1 - alignment) + this.sharedDirection.x * alignment;
    const desiredY = normal.y * (1 - alignment) + this.sharedDirection.y * alignment;
    const desiredLength = Math.max(0.001, Math.hypot(desiredX, desiredY));
    const targetDirection = { x: desiredX / desiredLength, y: desiredY / desiredLength };

    if (!wisp.direction) wisp.direction = { ...targetDirection };
    const directionEase = 1 - Math.exp(-dt * turnSpeed * 1.25);
    wisp.direction.x += (targetDirection.x - wisp.direction.x) * directionEase;
    wisp.direction.y += (targetDirection.y - wisp.direction.y) * directionEase;
    const directionLength = Math.max(0.001, Math.hypot(wisp.direction.x, wisp.direction.y));
    wisp.direction.x /= directionLength;
    wisp.direction.y /= directionLength;
    const actorScale = Math.max(0.25, Math.abs(this.actor.container.scale.x));
    const baseWidth = actorScale * 31 * widthScale;
    const attachmentDepth = baseWidth * 1.9 + actorScale * 22;
    const buriedRoot = {
      x: root.x - normal.x * attachmentDepth,
      y: root.y - normal.y * attachmentDepth
    };

    const points = [];
    const widths = [];
    const buriedSegments = 4;
    const visibleSegments = 18;
    const segmentCount = buriedSegments + visibleSegments;
    const visibleLength = configuredLength * extension;
    const controlA = {
      x: root.x + normal.x * visibleLength * 0.24,
      y: root.y + normal.y * visibleLength * 0.24
    };
    const tip = {
      x: root.x + wisp.direction.x * visibleLength,
      y: root.y + wisp.direction.y * visibleLength
    };
    const controlB = {
      x: tip.x - wisp.direction.x * visibleLength * 0.34,
      y: tip.y - wisp.direction.y * visibleLength * 0.34
    };

    for (let index = 0; index < segmentCount; index += 1) {
      if (index < buriedSegments) {
        const buriedProgress = index / buriedSegments;
        points.push({
          x: buriedRoot.x + normal.x * attachmentDepth * buriedProgress,
          y: buriedRoot.y + normal.y * attachmentDepth * buriedProgress
        });
        widths.push(baseWidth);
        continue;
      }

      const s = (index - buriedSegments) / (visibleSegments - 1);
      const inverse = 1 - s;
      const curveX = inverse * inverse * inverse * root.x
        + 3 * inverse * inverse * s * controlA.x
        + 3 * inverse * s * s * controlB.x
        + s * s * s * tip.x;
      const curveY = inverse * inverse * inverse * root.y
        + 3 * inverse * inverse * s * controlA.y
        + 3 * inverse * s * s * controlB.y
        + s * s * s * tip.y;
      const localDirectionX = normal.x * (1 - s) + wisp.direction.x * s;
      const localDirectionY = normal.y * (1 - s) + wisp.direction.y * s;
      const localDirectionLength = Math.max(0.001, Math.hypot(localDirectionX, localDirectionY));
      const localTangent = {
        x: -localDirectionY / localDirectionLength,
        y: localDirectionX / localDirectionLength
      };
      const wavePhase = this.time * waveSpeed + s * Math.PI * 2 * waveRepeats + wisp.phaseOffset;
      const rootQuiet = smoothstep(0.05, 0.28, s);
      const sway = Math.sin(wavePhase) * baseWidth * wave * s * 0.72 * rootQuiet;
      const sharedRipple = Math.sin(this.time * waveSpeed * 0.63 + s * Math.PI * waveRepeats) * baseWidth * wave * 0.08 * s * rootQuiet;
      points.push({
        x: curveX + localTangent.x * sway + wisp.direction.x * sharedRipple,
        y: curveY + localTangent.y * sway + wisp.direction.y * sharedRipple
      });
      const taper = Math.pow(Math.max(0, 1 - s), 0.68);
      const tissuePulse = 0.96 + Math.sin(this.time * 0.42 + s * 5.1) * 0.04;
      widths.push(Math.max(0.2, baseWidth * taper * tissuePulse));
    }

    const tint = rgbTint(config);
    wisp.graphics.clear();
    ribbonPath(wisp.graphics, points, widths, tint, opacity);
  }

  update(deltaTime, config) {
    const dt = Math.min(0.05, deltaTime / 60);
    this.time += dt;
    const amount = Math.max(0, Math.min(1, config.tendrilAmount ?? config.weatherLeak ?? 0));
    const maxTendrils = Math.max(0, Math.min(8, Math.round(config.tendrilCount ?? 3)));
    const desiredCount = amount > 0.001 ? maxTendrils : 0;
    this.syncFollicles(desiredCount);

    const actorX = this.actor.container.x;
    const actorY = this.actor.container.y;
    const rawVx = (actorX - this.lastActorPosition.x) / Math.max(dt, 0.001);
    const rawVy = (actorY - this.lastActorPosition.y) / Math.max(dt, 0.001);
    this.lastActorPosition.x = actorX;
    this.lastActorPosition.y = actorY;
    const turnSpeed = Math.max(0.5, config.tendrilTurnSpeed ?? 4);
    const velocityEase = 1 - Math.exp(-dt * turnSpeed * 1.25);
    this.smoothedVelocity.x += (rawVx - this.smoothedVelocity.x) * velocityEase;
    this.smoothedVelocity.y += (rawVy - this.smoothedVelocity.y) * velocityEase;

    const speed = Math.hypot(this.smoothedVelocity.x, this.smoothedVelocity.y);
    const restDirection = { x: -this.actor.facingDirection, y: 0.14 };
    const restLength = Math.hypot(restDirection.x, restDirection.y);
    restDirection.x /= restLength;
    restDirection.y /= restLength;
    const trailDirection = speed > 0.01
      ? { x: -this.smoothedVelocity.x / speed, y: -this.smoothedVelocity.y / speed }
      : restDirection;
    const movementResponse = Math.max(0, Math.min(2, config.tendrilMovement ?? 0.8));
    const movementBlend = smoothstep(8, 150, speed) * Math.min(1, movementResponse);
    const targetFlow = {
      x: restDirection.x * (1 - movementBlend) + trailDirection.x * movementBlend,
      y: restDirection.y * (1 - movementBlend) + trailDirection.y * movementBlend
    };
    const targetFlowLength = Math.max(0.001, Math.hypot(targetFlow.x, targetFlow.y));
    targetFlow.x /= targetFlowLength;
    targetFlow.y /= targetFlowLength;
    const flowEase = 1 - Math.exp(-dt * turnSpeed);
    this.sharedDirection.x += (targetFlow.x - this.sharedDirection.x) * flowEase;
    this.sharedDirection.y += (targetFlow.y - this.sharedDirection.y) * flowEase;
    const sharedLength = Math.max(0.001, Math.hypot(this.sharedDirection.x, this.sharedDirection.y));
    this.sharedDirection.x /= sharedLength;
    this.sharedDirection.y /= sharedLength;

    for (const wisp of this.wisps) this.drawWisp(wisp, config, dt);
  }

  destroy() {
    for (const wisp of this.wisps) wisp.graphics.destroy();
    this.wisps = [];
    if (this.container?.parent) this.container.parent.removeChild(this.container);
    this.container?.destroy({ children: true });
    this.container = null;
    this.actor = null;
    this.renderer = null;
  }
}
