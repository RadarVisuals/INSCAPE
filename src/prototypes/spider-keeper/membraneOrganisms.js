import { clamp, distanceBetween, lerp } from './spiderMotion.js';

export const SERPENT_DEFAULTS = Object.freeze({
  segmentCount: 46,
  segmentSpacing: 10,
  thickness: 12,
  speed: 220,
  depthFrequency: 0.42,
  depthAmplitude: 1,
});

export const SERPENT_RANGES = Object.freeze({
  segmentCount: { min: 20, max: 80, step: 2 },
  segmentSpacing: { min: 5, max: 18, step: 1 },
  thickness: { min: 4, max: 26, step: 1 },
  speed: { min: 60, max: 420, step: 10 },
  depthFrequency: { min: 0.16, max: 0.9, step: 0.02 },
  depthAmplitude: { min: 0.2, max: 1.8, step: 0.1 },
});

export function drawMembraneGrid(context, width, height, spacing = 68, alpha = 0.32) {
  context.strokeStyle = `rgba(244, 242, 234, ${alpha})`;
  context.lineWidth = 1;
  context.beginPath();
  for (let x = 0; x <= width + spacing; x += spacing) {
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }
  for (let y = 0; y <= height + spacing; y += spacing) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.stroke();

  context.fillStyle = `rgba(250, 248, 240, ${Math.min(0.9, alpha * 2)})`;
  for (let y = 0; y <= height + spacing; y += spacing) {
    for (let x = 0; x <= width + spacing; x += spacing) {
      context.beginPath();
      context.arc(x, y, 1.55, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function makeChain(center, count, spacing) {
  return Array.from({ length: count }, (_, index) => ({
    x: center.x,
    y: center.y + (index * spacing),
  }));
}

function advanceChain(nodes, target, delta, speed, spacing, reducedMotion) {
  if (nodes.length === 0) return 0;
  const head = nodes[0];
  const distance = distanceBetween(head, target);
  let activity = 0;
  if (distance > 0.1) {
    const travel = reducedMotion ? distance : Math.min(distance, speed * delta);
    const amount = travel / distance;
    head.x = lerp(head.x, target.x, amount);
    head.y = lerp(head.y, target.y, amount);
    activity = travel;
  }
  for (let index = 1; index < nodes.length; index += 1) {
    const leader = nodes[index - 1];
    const node = nodes[index];
    const dx = leader.x - node.x;
    const dy = leader.y - node.y;
    const length = Math.max(0.0001, Math.hypot(dx, dy));
    const nextX = leader.x - ((dx / length) * spacing);
    const nextY = leader.y - ((dy / length) * spacing);
    activity = Math.max(activity, Math.hypot(nextX - node.x, nextY - node.y));
    node.x = nextX;
    node.y = nextY;
  }
  return activity;
}

export function makeSerpent(center, tuning = SERPENT_DEFAULTS) {
  return {
    nodes: makeChain(center, tuning.segmentCount, tuning.segmentSpacing),
    depthPhase: 0,
  };
}

export function updateSerpent(state, target, delta, tuning, reducedMotion) {
  if (state.nodes.length !== tuning.segmentCount) {
    state.nodes = makeChain(state.nodes[0] || target, tuning.segmentCount, tuning.segmentSpacing);
  }
  const activity = advanceChain(state.nodes, target, delta, tuning.speed, tuning.segmentSpacing, reducedMotion);
  if (!reducedMotion) state.depthPhase += activity * 0.012;
  return activity;
}

function serpentDepth(state, index, tuning) {
  return Math.sin(state.depthPhase - (index * tuning.depthFrequency)) * tuning.depthAmplitude;
}

function drawSerpentLayer(context, serpent, tuning, above) {
  const nodes = serpent.nodes;
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const depth = serpentDepth(serpent, index, tuning);
    const nextDepth = serpentDepth(serpent, index + 1, tuning);
    const startsAbove = depth >= 0;
    const endsAbove = nextDepth >= 0;
    if (startsAbove === endsAbove && startsAbove !== above) continue;
    let from = nodes[index];
    let to = nodes[index + 1];
    if (startsAbove !== endsAbove) {
      const crossingAmount = Math.abs(depth) / Math.max(0.0001, Math.abs(depth) + Math.abs(nextDepth));
      const crossing = {
        x: lerp(from.x, to.x, crossingAmount),
        y: lerp(from.y, to.y, crossingAmount),
      };
      if (startsAbove === above) to = crossing;
      else from = crossing;
    }
    const taper = clamp(1 - (index / nodes.length) * 0.78, 0.16, 1);
    const magnitude = clamp(Math.abs((depth + nextDepth) * 0.5), 0, 1);
    context.strokeStyle = above
      ? `rgba(248, 246, 238, ${0.46 + (magnitude * 0.46)})`
      : `rgba(202, 210, 207, ${0.05 + (magnitude * 0.12)})`;
    context.lineWidth = tuning.thickness * taper * (above ? 0.72 + magnitude * 0.38 : 1.35);
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }
  context.lineCap = 'butt';
}

export function drawSerpentUnder(context, serpent, tuning) {
  context.save();
  drawSerpentLayer(context, serpent, tuning, false);
  const head = serpent.nodes[0];
  const neck = serpent.nodes[1];
  if (head && neck && serpentDepth(serpent, 0, tuning) < 0) {
    const heading = Math.atan2(head.y - neck.y, head.x - neck.x);
    context.translate(head.x, head.y);
    context.rotate(heading);
    context.fillStyle = 'rgba(204, 214, 210, 0.1)';
    context.beginPath();
    context.ellipse(0, 0, tuning.thickness * 0.92, tuning.thickness * 0.66, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

export function drawSerpentOver(context, serpent, tuning) {
  drawSerpentLayer(context, serpent, tuning, true);
  for (let index = 2; index < serpent.nodes.length; index += 2) {
    if (serpentDepth(serpent, index, tuning) <= 0) continue;
    const node = serpent.nodes[index];
    const taper = clamp(1 - (index / serpent.nodes.length) * 0.78, 0.18, 1);
    context.fillStyle = 'rgba(5, 6, 6, 0.58)';
    context.beginPath();
    context.arc(node.x, node.y, Math.max(0.7, tuning.thickness * taper * 0.12), 0, Math.PI * 2);
    context.fill();
  }
  for (let index = 0; index < serpent.nodes.length - 1; index += 1) {
    const depth = serpentDepth(serpent, index, tuning);
    const nextDepth = serpentDepth(serpent, index + 1, tuning);
    if ((depth >= 0) === (nextDepth >= 0)) continue;
    const crossingAmount = Math.abs(depth) / Math.max(0.0001, Math.abs(depth) + Math.abs(nextDepth));
    const crossing = {
      x: lerp(serpent.nodes[index].x, serpent.nodes[index + 1].x, crossingAmount),
      y: lerp(serpent.nodes[index].y, serpent.nodes[index + 1].y, crossingAmount),
    };
    context.strokeStyle = 'rgba(250, 248, 240, 0.72)';
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(crossing.x, crossing.y, tuning.thickness * 1.1, tuning.thickness * 0.42, 0, 0, Math.PI * 2);
    context.stroke();
  }
  const head = serpent.nodes[0];
  const neck = serpent.nodes[1];
  if (head && neck && serpentDepth(serpent, 0, tuning) >= 0) {
    const heading = Math.atan2(head.y - neck.y, head.x - neck.x);
    context.save();
    context.translate(head.x, head.y);
    context.rotate(heading);
    context.fillStyle = '#faf8ef';
    context.beginPath();
    context.ellipse(0, 0, tuning.thickness * 0.82, tuning.thickness * 0.58, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#050606';
    for (const side of [-1, 1]) {
      context.beginPath();
      context.arc(tuning.thickness * 0.28, side * tuning.thickness * 0.25, Math.max(0.9, tuning.thickness * 0.09), 0, Math.PI * 2);
      context.fill();
    }
    context.strokeStyle = 'rgba(250, 248, 240, 0.6)';
    context.lineWidth = 0.8;
    context.beginPath();
    context.moveTo(tuning.thickness * 0.62, -tuning.thickness * 0.15);
    context.lineTo(tuning.thickness * 1.15, -tuning.thickness * 0.34);
    context.moveTo(tuning.thickness * 0.62, tuning.thickness * 0.15);
    context.lineTo(tuning.thickness * 1.15, tuning.thickness * 0.34);
    context.stroke();
    context.restore();
  }
}
