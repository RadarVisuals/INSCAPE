export const SPIDER_MOTION = Object.freeze({
  gridSize: 68,
  legCount: 12,
  legRadius: 98,
  bodySpeed: 680,
  settleDistance: 0.45,
  replantDistance: 26,
  maxStretch: 54,
  maxConcurrentSteps: 6,
  stepDuration: 0.18,
  stepStagger: 0.018,
  stepLift: 13,
  jointBend: 10,
  edgePadding: 34,
  maxDelta: 1 / 24,
});

export const SPIDER_CONTROL_RANGES = Object.freeze({
  legCount: { min: 4, max: 16, step: 1 },
  legRadius: { min: 58, max: 190, step: 2 },
  maxStretch: { min: 18, max: 110, step: 2 },
  bodySpeed: { min: 80, max: 1200, step: 20 },
  stepDuration: { min: 0.12, max: 0.72, step: 0.02 },
  stepLift: { min: 0, max: 34, step: 1 },
  jointBend: { min: 0, max: 28, step: 1 },
});

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (from, to, amount) => from + ((to - from) * amount);

export const easeInOutCubic = (value) => (
  value < 0.5
    ? 4 * value * value * value
    : 1 - (Math.pow(-2 * value + 2, 3) / 2)
);

export function snapToGrid(point, gridSize = SPIDER_MOTION.gridSize) {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

export function clampPoint(point, width, height, padding = SPIDER_MOTION.edgePadding) {
  return {
    x: clamp(point.x, padding, Math.max(padding, width - padding)),
    y: clamp(point.y, padding, Math.max(padding, height - padding)),
  };
}

export function legDirection(index, count = SPIDER_MOTION.legCount) {
  const angle = (-Math.PI / 2) + ((index / count) * Math.PI * 2);
  return { x: Math.cos(angle), y: Math.sin(angle), angle };
}

export function desiredFoot(
  center,
  leg,
  radius = SPIDER_MOTION.legRadius,
  gridSize = SPIDER_MOTION.gridSize,
) {
  return snapToGrid({
    x: center.x + (leg.direction.x * radius),
    y: center.y + (leg.direction.y * radius),
  }, gridSize);
}

export function distanceBetween(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

export function makeLegs(
  center,
  count = SPIDER_MOTION.legCount,
  radius = SPIDER_MOTION.legRadius,
  gridSize = SPIDER_MOTION.gridSize,
) {
  return Array.from({ length: count }, (_, index) => {
    const direction = legDirection(index, count);
    const leg = {
      index,
      direction,
      bend: index % 2 === 0 ? 1 : -1,
      foot: { x: center.x, y: center.y },
      step: null,
    };
    leg.foot = desiredFoot(center, leg, radius, gridSize);
    return leg;
  });
}
