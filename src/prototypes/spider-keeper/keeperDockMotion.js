import { clamp } from './spiderMotion.js';

export const KEEPER_DOCK_MOTION = Object.freeze({
  approachRadius: 18,
  foldDuration: 0.82,
  unfoldDuration: 0.96,
  releaseDistanceX: 210,
  releaseDistanceY: 145,
});

const FOLD_PROFILES = Object.freeze({
  walker: { firstAxis: 'y', turn: -0.18, shear: 0.08 },
  crawler: { firstAxis: 'x', turn: 0.34, shear: -0.12 },
  manta: { firstAxis: 'y', turn: -0.3, shear: 0.16 },
  jelly: { firstAxis: 'y', turn: 0.16, shear: -0.09 },
  serpent: { firstAxis: 'x', turn: -0.42, shear: 0.14 },
});

export const easeInOutQuart = (value) => (
  value < 0.5
    ? 8 * value * value * value * value
    : 1 - (Math.pow(-2 * value + 2, 4) / 2)
);

function smoothRange(value, from, to) {
  const normalized = clamp((value - from) / Math.max(0.0001, to - from), 0, 1);
  return normalized * normalized * (3 - (2 * normalized));
}

export function dockPointFromBounds(bounds) {
  if (!bounds) return null;
  return {
    x: bounds.left + (bounds.width * 0.5),
    y: bounds.top + (bounds.height * 0.5),
  };
}

export function releasePointFromDock(point, width, height) {
  return {
    x: clamp(point.x - Math.min(KEEPER_DOCK_MOTION.releaseDistanceX, width * 0.28), 70, width - 70),
    y: clamp(point.y - Math.min(KEEPER_DOCK_MOTION.releaseDistanceY, height * 0.24), 70, height - 70),
  };
}

export function foldVisual(amount, creature) {
  const progress = clamp(amount, 0, 1);
  const profile = FOLD_PROFILES[creature] || FOLD_PROFILES.walker;
  const firstFold = smoothRange(progress, 0, 0.66);
  const secondFold = smoothRange(progress, 0.36, 1);
  const firstScale = 1 - (firstFold * 0.78);
  const secondScale = 1 - (secondFold * 0.9);
  const scaleX = profile.firstAxis === 'x' ? firstScale * secondScale : secondScale;
  const scaleY = profile.firstAxis === 'y' ? firstScale * secondScale : secondScale;
  return {
    scaleX: Math.max(0.035, scaleX),
    scaleY: Math.max(0.035, scaleY),
    rotation: profile.turn * easeInOutQuart(progress),
    shear: profile.shear * Math.sin(progress * Math.PI),
    alpha: 1 - (smoothRange(progress, 0.76, 1) * 0.92),
  };
}

export function applyFoldTransform(context, point, amount, creature) {
  if (!point || amount <= 0) return;
  const visual = foldVisual(amount, creature);
  context.translate(point.x, point.y);
  context.rotate(visual.rotation);
  context.transform(1, visual.shear, -visual.shear * 0.45, 1, 0, 0);
  context.scale(visual.scaleX, visual.scaleY);
  context.translate(-point.x, -point.y);
  context.globalAlpha *= visual.alpha;
}

export function drawFoldSeams(context, point, amount, creature) {
  if (!point || amount <= 0 || amount >= 1) return;
  const progress = easeInOutQuart(amount);
  const profile = FOLD_PROFILES[creature] || FOLD_PROFILES.walker;
  const radiusX = 34 * (1 - progress) + 5;
  const radiusY = 28 * (1 - progress) + 4;
  const energy = Math.sin(amount * Math.PI);
  context.save();
  context.translate(point.x, point.y);
  context.rotate(profile.turn * progress);
  context.strokeStyle = `rgba(250, 248, 240, ${energy * 0.42})`;
  context.lineWidth = 0.8;
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    context.beginPath();
    context.moveTo(Math.cos(angle) * radiusX, Math.sin(angle) * radiusY);
    context.lineTo(Math.cos(angle) * 4, Math.sin(angle) * 3);
    context.stroke();
  }
  context.strokeStyle = `rgba(250, 248, 240, ${energy * 0.56})`;
  context.beginPath();
  context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}
