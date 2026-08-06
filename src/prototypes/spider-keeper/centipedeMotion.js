import { clamp, distanceBetween, lerp } from './spiderMotion.js';

export const CRAWLER_MOTION = Object.freeze({
  segmentCount: 34,
  segmentSpacing: 8,
  legLength: 38,
  headSpeed: 260,
  waveSpeed: 4.4,
  phaseSpread: 0.52,
  legSweep: 11,
  edgePadding: 42,
});

export const CRAWLER_CONTROL_RANGES = Object.freeze({
  segmentCount: { min: 12, max: 60, step: 2 },
  segmentSpacing: { min: 4, max: 16, step: 1 },
  legLength: { min: 18, max: 70, step: 2 },
  headSpeed: { min: 80, max: 560, step: 10 },
  waveSpeed: { min: 0, max: 10, step: 0.2 },
  phaseSpread: { min: 0.12, max: 1.2, step: 0.04 },
  legSweep: { min: 0, max: 28, step: 1 },
});

export function makeCrawler(center, count = CRAWLER_MOTION.segmentCount, spacing = CRAWLER_MOTION.segmentSpacing) {
  return Array.from({ length: count }, (_, index) => ({
    x: center.x,
    y: center.y + (index * spacing),
  }));
}

export function advanceCrawler(nodes, target, delta, tuning, reducedMotion) {
  if (nodes.length === 0) return 0;
  const head = nodes[0];
  const distance = distanceBetween(head, target);
  let activity = 0;
  if (distance > 0.1) {
    const travel = reducedMotion ? distance : Math.min(distance, tuning.headSpeed * delta);
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
    const nextX = leader.x - ((dx / length) * tuning.segmentSpacing);
    const nextY = leader.y - ((dy / length) * tuning.segmentSpacing);
    activity = Math.max(activity, Math.hypot(nextX - node.x, nextY - node.y));
    node.x = nextX;
    node.y = nextY;
  }
  return activity;
}

export function drawCrawler(context, nodes, gaitPhase, tuning, motionEnergy = 0) {
  if (nodes.length < 2) return;

  context.strokeStyle = 'rgba(242, 240, 232, 0.2)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(nodes[0].x, nodes[0].y);
  for (let index = 1; index < nodes.length; index += 1) {
    context.lineTo(nodes[index].x, nodes[index].y);
  }
  context.stroke();

  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const root = nodes[index];
    const before = nodes[Math.max(0, index - 1)];
    const after = nodes[Math.min(nodes.length - 1, index + 1)];
    const tangentX = before.x - after.x;
    const tangentY = before.y - after.y;
    const tangentLength = Math.max(0.0001, Math.hypot(tangentX, tangentY));
    const tx = tangentX / tangentLength;
    const ty = tangentY / tangentLength;
    const nx = -ty;
    const ny = tx;
    const basePhase = gaitPhase - (index * tuning.phaseSpread);
    const taper = clamp(index / Math.max(1, nodes.length * 0.18), 0.34, 1);

    for (const side of [-1, 1]) {
      const phase = basePhase + (side < 0 ? Math.PI : 0);
      const jointSweep = Math.sin(phase) * tuning.legSweep;
      const tipSweep = Math.sin(phase + 1.25) * tuning.legSweep;
      const jointDistance = tuning.legLength * 0.58 * taper;
      const tipDistance = tuning.legLength * 0.42 * taper;
      const joint = {
        x: root.x + (nx * side * jointDistance) + (tx * jointSweep),
        y: root.y + (ny * side * jointDistance) + (ty * jointSweep),
      };
      const tip = {
        x: joint.x + (nx * side * tipDistance) + (tx * tipSweep),
        y: joint.y + (ny * side * tipDistance) + (ty * tipSweep),
      };

      const contactEnergy = 0.56 + (motionEnergy * 0.2) + (Math.sin(phase) * 0.05);
      context.strokeStyle = `rgba(242, 240, 232, ${contactEnergy})`;
      context.lineWidth = index === 0 ? 1.3 : 0.9;
      context.beginPath();
      context.moveTo(root.x, root.y);
      context.lineTo(joint.x, joint.y);
      context.lineTo(tip.x, tip.y);
      context.stroke();

      context.fillStyle = 'rgba(248, 246, 238, 0.88)';
      context.beginPath();
      context.arc(joint.x, joint.y, 1.45, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(tip.x, tip.y, 1.1, 0, Math.PI * 2);
      context.fill();
    }

    context.fillStyle = index === 0 ? '#faf8ef' : 'rgba(248, 246, 238, 0.72)';
    context.beginPath();
    context.arc(root.x, root.y, index === 0 ? 3.5 : (index % 2 === 0 ? 1.8 : 1.2), 0, Math.PI * 2);
    context.fill();
  }

  const head = nodes[0];
  const neck = nodes[1];
  const heading = Math.atan2(head.y - neck.y, head.x - neck.x);
  const feelerSway = Math.sin(gaitPhase * 1.7) * 3 * motionEnergy;
  context.save();
  context.translate(head.x, head.y);
  context.rotate(heading);
  context.fillStyle = '#faf8ef';
  context.strokeStyle = 'rgba(5, 6, 6, 0.78)';
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(0, 0, 6.8, 4.8, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = '#050606';
  context.beginPath();
  context.arc(2.4, -1.8, 0.9, 0, Math.PI * 2);
  context.arc(2.4, 1.8, 0.9, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(248, 246, 238, 0.7)';
  context.beginPath();
  context.moveTo(4, -2.2);
  context.quadraticCurveTo(10, -7 - feelerSway, 16, -5 + feelerSway * 0.4);
  context.moveTo(4, 2.2);
  context.quadraticCurveTo(10, 7 + feelerSway, 16, 5 - feelerSway * 0.4);
  context.moveTo(5.8, -1.6);
  context.lineTo(9.5, -0.7);
  context.moveTo(5.8, 1.6);
  context.lineTo(9.5, 0.7);
  context.stroke();
  context.restore();

  const tail = nodes[nodes.length - 1];
  const tailBase = nodes[nodes.length - 2];
  const tailHeading = Math.atan2(tail.y - tailBase.y, tail.x - tailBase.x);
  context.save();
  context.translate(tail.x, tail.y);
  context.rotate(tailHeading);
  context.strokeStyle = 'rgba(248, 246, 238, 0.42)';
  context.lineWidth = 0.8;
  context.beginPath();
  context.moveTo(0, 0);
  context.quadraticCurveTo(5, -2, 10, -4);
  context.moveTo(0, 0);
  context.quadraticCurveTo(5, 2, 10, 4);
  context.stroke();
  context.restore();
}
