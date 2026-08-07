// Shared production motion authority for the single INSCAPE grid resident.
export const GRID_WALKER = Object.freeze({
  gridSize: 68,
  legCount: 12,
  legRadius: 98,
  maxStretch: 54,
  bodySpeed: 680,
  settleDistance: 0.45,
  replantDistance: 26,
  maxConcurrentSteps: 6,
  stepDuration: 0.18,
  stepStagger: 0.018,
  stepLift: 13,
  jointBend: 10,
  edgePadding: 34,
  maxDelta: 1 / 24,
});

export const GRID_WALKER_TUNING = Object.freeze({
  size: 0.72,
  gridSize: GRID_WALKER.gridSize,
  legCount: GRID_WALKER.legCount,
  legRadius: GRID_WALKER.legRadius,
  maxStretch: GRID_WALKER.maxStretch,
  bodySpeed: GRID_WALKER.bodySpeed,
  stepDuration: GRID_WALKER.stepDuration,
  stepLift: GRID_WALKER.stepLift,
  jointBend: GRID_WALKER.jointBend,
  hingeRadius: 7.25,
});

export const GRID_WALKER_RANGES = Object.freeze({
  size: { min: 0.2, max: 1.25, step: 0.05 },
  gridSize: { min: 16, max: 104, step: 4 },
  legCount: { min: 4, max: 16, step: 1 },
  legRadius: { min: 12, max: 180, step: 2 },
  maxStretch: { min: 4, max: 110, step: 2 },
  bodySpeed: { min: 80, max: 1000, step: 20 },
  stepDuration: { min: 0.1, max: 0.7, step: 0.02 },
  stepLift: { min: 0, max: 34, step: 1 },
  jointBend: { min: 0, max: 28, step: 1 },
  hingeRadius: { min: 1.5, max: 16, step: 0.5 },
});

export const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
export const lerp = (from, to, amount) => from + ((to - from) * amount);
const distance = (first, second) => Math.hypot(second.x - first.x, second.y - first.y);
const easeInOutCubic = (value) => value < 0.5
  ? 4 * value * value * value
  : 1 - (Math.pow(-2 * value + 2, 3) / 2);

export function clampPoint(point, width, height) {
  const padding = GRID_WALKER.edgePadding;
  return {
    x: clamp(point.x, padding, Math.max(padding, width - padding)),
    y: clamp(point.y, padding, Math.max(padding, height - padding)),
  };
}

export function snapToGrid(point, gridSize = GRID_WALKER.gridSize, origin = { x: 0, y: 0 }) {
  const originX = Number.isFinite(origin?.x) ? origin.x : 0;
  const originY = Number.isFinite(origin?.y) ? origin.y : 0;
  return {
    x: originX + (Math.round((point.x - originX) / gridSize) * gridSize),
    y: originY + (Math.round((point.y - originY) / gridSize) * gridSize),
  };
}

function desiredFoot(center, leg, tuning, velocity = { x: 0, y: 0 }) {
  const radius = tuning.legRadius * tuning.size;
  const speed = Math.hypot(velocity.x, velocity.y);
  const leadAmount = Math.min(radius * 0.46, speed * 0.075);
  const leadX = speed > 0.01 ? (velocity.x / speed) * leadAmount : 0;
  const leadY = speed > 0.01 ? (velocity.y / speed) * leadAmount : 0;
  const forwardWeight = speed > 0.01
    ? Math.max(0, (leg.direction.x * velocity.x + leg.direction.y * velocity.y) / speed)
    : 0;
  return snapToGrid({
    x: center.x + (leg.direction.x * radius) + (leadX * (0.35 + forwardWeight * 0.65)),
    y: center.y + (leg.direction.y * radius) + (leadY * (0.35 + forwardWeight * 0.65)),
  }, tuning.gridSize, { x: tuning.gridOriginX, y: tuning.gridOriginY });
}

function makeLegs(center, tuning) {
  return Array.from({ length: tuning.legCount }, (_, index) => {
    const angle = (-Math.PI / 2) + ((index / tuning.legCount) * Math.PI * 2);
    const leg = {
      direction: { x: Math.cos(angle), y: Math.sin(angle) },
      bend: index % 2 === 0 ? 1 : -1,
      foot: { ...center },
      step: null,
    };
    leg.foot = desiredFoot(center, leg, tuning);
    return leg;
  });
}

export function createGridWalker(center, tuning = GRID_WALKER_TUNING) {
  return {
    center: { ...center },
    target: { ...center },
    heading: 0,
    activity: 0,
    velocity: { x: 0, y: 0 },
    nextStepAt: 0,
    legs: makeLegs(center, tuning),
  };
}

export function retuneGridWalker(walker, tuning) {
  walker.legs = makeLegs(walker.center, tuning);
  walker.nextStepAt = 0;
}

export function moveGridWalkerTarget(walker, point, width, height) {
  walker.target = clampPoint(point, width, height);
}

function updateLegs(walker, now, reducedMotion, tuning) {
  const legRadius = tuning.legRadius * tuning.size;
  const maxStretch = tuning.maxStretch * tuning.size;
  for (const leg of walker.legs) {
    if (leg.step && now >= leg.step.startedAt + leg.step.duration) {
      leg.foot = leg.step.to;
      leg.step = null;
    }
  }
  const candidates = walker.legs
    .filter((leg) => !leg.step)
    .map((leg) => {
      const target = desiredFoot(walker.center, leg, tuning, walker.velocity);
      const error = distance(leg.foot, target);
      const reach = distance(walker.center, leg.foot);
      return { leg, target, urgency: Math.max(error, reach), shouldStep: error > GRID_WALKER.replantDistance * tuning.size || reach > legRadius + maxStretch };
    })
    .filter((candidate) => candidate.shouldStep)
    .sort((first, second) => second.urgency - first.urgency);
  if (reducedMotion) {
    for (const candidate of candidates) candidate.leg.foot = candidate.target;
    return;
  }
  const active = walker.legs.filter((leg) => leg.step).length;
  if (!candidates.length || active >= Math.min(GRID_WALKER.maxConcurrentSteps, Math.ceil(tuning.legCount / 2)) || now < walker.nextStepAt) return;
  const { leg, target } = candidates[0];
  const urgencyRatio = clamp(candidates[0].urgency / Math.max(1, legRadius + maxStretch), 0, 1);
  const cadenceVariation = 0.92 + ((walker.legs.indexOf(leg) % 4) * 0.045);
  leg.step = {
    from: { ...leg.foot },
    to: target,
    startedAt: now,
    duration: tuning.stepDuration * cadenceVariation * lerp(1.16, 0.68, urgencyRatio),
  };
  walker.nextStepAt = now + GRID_WALKER.stepStagger;
}

export function updateGridWalker(walker, delta, now, reducedMotion = false, tuning = GRID_WALKER_TUNING) {
  const distanceToTarget = distance(walker.center, walker.target);
  if (reducedMotion) {
    walker.center.x = walker.target.x;
    walker.center.y = walker.target.y;
    walker.velocity.x = 0;
    walker.velocity.y = 0;
    walker.activity = 0;
  } else {
    const dx = walker.target.x - walker.center.x;
    const dy = walker.target.y - walker.center.y;
    const length = Math.max(0.0001, Math.hypot(dx, dy));
    const desiredSpeed = distanceToTarget > GRID_WALKER.settleDistance
      ? Math.min(tuning.bodySpeed, distanceToTarget * 4.2)
      : 0;
    const desiredVelocityX = (dx / length) * desiredSpeed;
    const desiredVelocityY = (dy / length) * desiredSpeed;
    const velocityBlend = 1 - Math.exp(-(desiredSpeed > 0 ? 5.6 : 7.2) * delta);
    walker.velocity.x = lerp(walker.velocity.x, desiredVelocityX, velocityBlend);
    walker.velocity.y = lerp(walker.velocity.y, desiredVelocityY, velocityBlend);

    const travelX = walker.velocity.x * delta;
    const travelY = walker.velocity.y * delta;
    const travelDistance = Math.hypot(travelX, travelY);
    if (travelDistance >= distanceToTarget && distanceToTarget < tuning.bodySpeed * delta * 1.5) {
      walker.center.x = walker.target.x;
      walker.center.y = walker.target.y;
      walker.velocity.x *= 0.72;
      walker.velocity.y *= 0.72;
    } else {
      walker.center.x += travelX;
      walker.center.y += travelY;
    }
    walker.activity = Math.hypot(walker.velocity.x, walker.velocity.y);
    if (walker.activity > 0.1) {
      const desiredHeading = Math.atan2(walker.velocity.y, walker.velocity.x) + (Math.PI / 2);
      const turn = Math.atan2(Math.sin(desiredHeading - walker.heading), Math.cos(desiredHeading - walker.heading));
      walker.heading += turn * (1 - Math.exp(-7.5 * delta));
    }
  }
  updateLegs(walker, now, reducedMotion, tuning);
  return distanceToTarget > 0.8 || walker.activity > 1 || walker.legs.some((leg) => leg.step);
}

function currentFoot(leg, now, tuning) {
  if (!leg.step) return leg.foot;
  const raw = clamp((now - leg.step.startedAt) / leg.step.duration, 0, 1);
  const progress = easeInOutCubic(raw);
  const x = lerp(leg.step.from.x, leg.step.to.x, progress);
  const y = lerp(leg.step.from.y, leg.step.to.y, progress);
  const dx = leg.step.to.x - leg.step.from.x;
  const dy = leg.step.to.y - leg.step.from.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const lift = Math.sin(raw * Math.PI) * tuning.stepLift * tuning.size;
  return { x: x + ((-dy / length) * lift * leg.bend), y: y + ((dx / length) * lift * leg.bend) };
}

export function drawGridWalker(context, walker, now, tuning = GRID_WALKER_TUNING) {
  const center = walker.center;
  const ink = tuning.ink || '#f3f1e9';
  const surface = tuning.surface || '#050606';
  const legRadius = tuning.legRadius * tuning.size;
  const maxStretch = Math.max(1, tuning.maxStretch * tuning.size);
  const lineScale = clamp(tuning.size, 0.55, 1.25);
  for (const leg of walker.legs) {
    const foot = currentFoot(leg, now, tuning);
    const dx = foot.x - center.x;
    const dy = foot.y - center.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const tension = clamp((length - legRadius) / maxStretch, 0, 1);
    const joint = {
      x: lerp(center.x, foot.x, 0.56) + ((-dy / length) * tuning.jointBend * tuning.size * leg.bend),
      y: lerp(center.y, foot.y, 0.56) + ((dx / length) * tuning.jointBend * tuning.size * leg.bend),
    };
    context.strokeStyle = ink;
    context.globalAlpha = leg.step ? .92 : 0.56 + tension * 0.3;
    context.lineWidth = (leg.step ? 1.35 : 0.95 + (tension * 0.25)) * lineScale;
    context.beginPath();
    context.moveTo(center.x, center.y);
    context.lineTo(joint.x, joint.y);
    context.lineTo(foot.x, foot.y);
    context.stroke();
    context.fillStyle = ink;
    context.globalAlpha = .96;
    for (const [point, radius] of [[joint, (leg.step ? 3.1 : 2.65) * lineScale], [foot, (leg.step ? 2.75 : 2.15) * lineScale]]) {
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
    }
    if (!leg.step) {
      context.strokeStyle = ink;
      context.globalAlpha = 0.12 + tension * 0.25;
      context.lineWidth = 0.75;
      context.beginPath();
      context.arc(foot.x, foot.y, (4 + (tension * 1.5)) * lineScale, 0, Math.PI * 2);
      context.stroke();
    }
  }
  context.save();
  context.globalAlpha = 1;
  context.translate(center.x, center.y);
  context.fillStyle = ink;
  context.strokeStyle = ink;
  context.lineWidth = 0.85;
  context.beginPath();
  context.arc(0, 0, (tuning.hingeRadius + 4.25) * tuning.size, 0, Math.PI * 2);
  context.globalAlpha = .48;
  context.stroke();
  context.beginPath();
  context.arc(0, 0, tuning.hingeRadius * tuning.size, 0, Math.PI * 2);
  context.globalAlpha = .97;
  context.fill();
  context.fillStyle = surface;
  context.globalAlpha = 1;
  context.beginPath();
  context.arc(0, 0, Math.max(1, tuning.hingeRadius * tuning.size * 0.3), 0, Math.PI * 2);
  context.fill();
  context.restore();
  context.globalAlpha = 1;
}
