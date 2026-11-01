import { KEEPER_SWIM_DEFAULTS } from './keeperSwim.js';

const mix = (a, b, t) => a + (b - a) * t;
const response = (dt, seconds) => 1 - Math.exp(-dt * Math.LN10 / seconds);
const turn = (from, to, t) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * t;
const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function createKeeperSnakePose(rig) {
  return { elapsed: 0, stretch: 0, angle: 0, trail: [], origin: null, size: null,
    parts: rig.parts.map(part => ({ x: part.x, y: part.y, angle: 0 })) };
}

function sample(trail, distance) {
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1], b = trail[i], gap = length(a, b);
    if (distance <= gap || i === trail.length - 1) {
      const t = gap > 0 ? distance / gap : 0;
      return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), heading: Math.atan2(a.y - b.y, a.x - b.x) };
    }
    distance -= gap;
  }
  return { ...trail[0], heading: 0 };
}

// The shared flight controller moves the head. A bounded trail of its actual
// screen positions drives the chain, so corners propagate instead of rotating
// the whole animal at once. Only this temporary pose owns that history.
export function stepKeeperSnakePose(pose, rig, motion, dt, {
  size = 384, bounds, reducedMotion = false, swim = KEEPER_SWIM_DEFAULTS,
} = {}) {
  if (reducedMotion) return pose;
  const delta = Math.max(0, Math.min(dt, .05));
  if (!delta) return pose;
  const head = { x: motion.x, y: motion.y };
  const segments = rig.parts.filter(part => part.distance);
  if (!pose.origin) {
    pose.trail = [head, ...segments.map(part => ({ x: head.x + part.x * size, y: head.y + part.y * size }))];
  } else if (pose.size !== size) {
    // A live size edit/viewport fit preserves the bend without stale distances.
    pose.trail = pose.trail.map(point => ({ x: head.x + (point.x - pose.origin.x) * size / pose.size,
      y: head.y + (point.y - pose.origin.y) * size / pose.size }));
  }
  pose.origin = head; pose.size = size; pose.elapsed += delta;
  const speed = Math.hypot(motion.vx, motion.vy), moving = Math.min(1, speed / swim.speed);
  pose.stretch = mix(pose.stretch, moving, response(delta, moving > pose.stretch ? swim.spreadSeconds : swim.gatherSeconds));
  const target = motion.heading ?? (speed > 8 ? Math.atan2(motion.vy, motion.vx) : rig.sourceHeading);
  pose.angle = turn(pose.angle, target - rig.sourceHeading, response(delta, swim.turnSeconds));
  // Fixed spatial sampling bounds memory independently of frame rate or idle time.
  const spacing = Math.max(.5, size / 400);
  if (length(head, pose.trail[0]) >= spacing) pose.trail.unshift(head);
  const trail = [head, ...pose.trail];
  const reach = segments.at(-1).distance * size * 1.5 + size * .1;
  let travelled = 0;
  for (let i = 1; i < pose.trail.length; i++) {
    travelled += length(pose.trail[i - 1], pose.trail[i]);
    if (travelled > reach) { pose.trail.length = i + 1; break; }
  }
  // In a stationary pose the ripple settles almost completely. While moving,
  // a travelling wave gives a straight mouse path the requested S motion.
  const wave = (distance, heading) => {
    const envelope = Math.min(1, distance / (.10 * size));
    const amplitude = size * (.001 + pose.stretch * .022) * envelope;
    const offset = Math.sin(pose.elapsed * (3 + pose.stretch * 4) - distance / size * 22) * amplitude;
    return { x: -Math.sin(heading) * offset, y: Math.cos(heading) * offset };
  };
  rig.parts.forEach((part, index) => {
    const output = pose.parts[index];
    if (!part.distance) {
      // The eye follows translation but never inherits the head's rotation.
      const angle = part.id === 'eye' ? 0 : pose.angle;
      Object.assign(output, { x: part.x * Math.cos(angle) - part.y * Math.sin(angle),
        y: part.x * Math.sin(angle) + part.y * Math.cos(angle), angle });
      return;
    }
    const distance = part.distance * size * (1 + .5 * pose.stretch);
    const point = sample(trail, distance), ripple = wave(distance, point.heading);
    const ahead = sample(trail, Math.max(0, distance - size * .008));
    const behind = sample(trail, distance + size * .008);
    const a = wave(Math.max(0, distance - size * .008), ahead.heading);
    const b = wave(distance + size * .008, behind.heading);
    const angle = Math.atan2(ahead.y + a.y - behind.y - b.y, ahead.x + a.x - behind.x - b.x) - part.sourceHeading;
    let x = point.x + ripple.x, y = point.y + ripple.y;
    if (bounds) {
      const radius = Math.hypot(part.width, part.height) * size / 2;
      x = Math.max(bounds.left + radius, Math.min(bounds.right - radius, x));
      y = Math.max(bounds.top + radius, Math.min(bounds.bottom - radius, y));
    }
    Object.assign(output, { x: (x - head.x) / size, y: (y - head.y) / size,
      angle: turn(output.angle, angle, response(delta, .07)) });
  });
  return pose;
}
