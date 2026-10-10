import { KEEPER_SWIM_DEFAULTS } from './keeperSwim.js';

export const KEEPER_MOTION = Object.freeze({ radius: 125, pointerGap: 105, sideOffset: 220, maxSpeed: 240, maxAcceleration: 540 });
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const bounded = (p, bounds) => ({ x: clamp(p.x, bounds.left, bounds.right), y: clamp(p.y, bounds.top, bounds.bottom) });
// Fit only the temporary on-screen creature, retaining saved size and dock geometry.
// The margin includes perspective and idle bob, including on narrow viewports.
export function keeperViewport(size, width, height) {
  const renderedSize = Math.max(1, Math.min(size, (width - 16) / 1.16, (height - 88) / 1.16));
  const inset = renderedSize * .58 + 8;
  return { size: renderedSize, bounds: { left: Math.min(inset, width / 2), right: Math.max(width / 2, width - inset),
    top: Math.min(inset + 24, height / 2), bottom: Math.max(height / 2, height - inset - 48) } };
}
export function keeperZone(pointer, bounds, size = 128) {
  const offset = Math.max(KEEPER_MOTION.sideOffset, size / 2 + 100);
  const right = bounds.right - pointer.x, left = pointer.x - bounds.left;
  const side = right >= offset || right >= left ? 1 : -1;
  return bounded({ x: pointer.x + side * offset, y: pointer.y - 24 }, bounds);
}
export function createKeeperMotion(home) {
  return { ...home, zone: { ...home }, wander: null, resting: false, phase: 'docked', facing: 1,
    vx: 0, vy: 0, waiting: 0, elapsed: 0 };
}
export function releaseKeeper(state) { state.phase = 'free'; state.wander = null; state.resting = false; state.waiting = 0; }
export function returnKeeper(state) { stopKeeperReaction(state); state.steering = false; state.phase = 'returning'; }
export function stopKeeperReaction(state) { if (state) { state.reaction = null; state.expression = null; } }
export function beginKeeperReaction(state, gesture, point, bounds, size = 128) {
  if (!state || state.phase !== 'free' || state.steering || !['curious', 'startled', 'approach', 'retreat'].includes(gesture)) return false;
  const moving = gesture === 'approach' || gesture === 'retreat';
  if (moving && (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;
  const angle = point ? Math.atan2(point.y - state.y, point.x - state.x) : state.heading || 0;
  const travel = moving ? gesture === 'retreat' ? -Math.min(160, size * .6) : Math.min(150, Math.max(0, distance(state, point) - size * .55)) : 0;
  const goal = bounded({ x: state.x + Math.cos(angle) * travel, y: state.y + Math.sin(angle) * travel }, bounds);
  state.reaction = { gesture, elapsed: 0, duration: moving ? 3.2 : 2.6, goal, heading: moving ? angle : state.heading };
  return true;
}
export function moveKeeperTo(state, destination) {
  if (state.phase === 'free') state.destination = { x: destination.x, y: destination.y };
}
export function steerKeeper(state, destination) {
  if (!state || state.phase !== 'free') return;
  stopKeeperReaction(state); moveKeeperTo(state, destination); state.steering = true;
}
export function faceKeeperPointer(state, pointer) {
  if (state.phase === 'free' && pointer && pointer.x !== state.x) state.facing = pointer.x > state.x ? 1 : -1;
}

// A damped spring with bounded acceleration preserves velocity through pointer
// changes and recall. Small integration steps behave alike at 30/60/120 Hz.
function glide(state, goal, delta, returning, swim) {
  let remaining = delta;
  const frequency = swim ? 5 : returning ? 4.5 : 3.6;
  const limit = swim ? swim.speed * 3 : KEEPER_MOTION.maxAcceleration;
  const maximum = swim ? swim.speed : returning ? 360 : KEEPER_MOTION.maxSpeed;
  // The head sees the destination immediately, even while momentum still points
  // the other way. Retain the final heading near arrival instead of jittering.
  if (swim && distance(state, goal) > 8) state.heading = Math.atan2(goal.y - state.y, goal.x - state.x);
  while (remaining > 0) {
    const dt = Math.min(remaining, 1 / 120); remaining -= dt;
    const previousSpeed = Math.hypot(state.vx, state.vy);
    let ax = frequency ** 2 * (goal.x - state.x) - 2 * frequency * state.vx;
    let ay = frequency ** 2 * (goal.y - state.y) - 2 * frequency * state.vy;
    const acceleration = Math.hypot(ax, ay);
    if (acceleration > limit) { ax *= limit / acceleration; ay *= limit / acceleration; }
    state.vx += ax * dt; state.vy += ay * dt;
    const speed = Math.hypot(state.vx, state.vy);
    // Lowering the live speed control brakes instead of discarding velocity.
    const ceiling = swim ? Math.max(maximum, previousSpeed - limit * dt) : maximum;
    if (speed > ceiling) { state.vx *= ceiling / speed; state.vy *= ceiling / speed; }
    state.x += state.vx * dt; state.y += state.vy * dt;
  }
}

// Both character styles share flight, recall and screen-space bounds. The
// movement choice owns destination selection, not a second animation lifecycle.
export function stepKeeper(state, { dt, pointer, home, bounds, size = 128, random = Math.random, movement = 'flip', swim = KEEPER_SWIM_DEFAULTS, paused = false }) {
  const delta = clamp(dt, 0, .05);
  state.elapsed += delta;
  if (state.phase === 'docked') { Object.assign(state, home, { vx: 0, vy: 0 }); return state; }
  if (paused && state.phase === 'free') {
    if (state.steering) {
      const goal = bounded(state.destination, bounds);
      glide(state, goal, delta, false, swim);
      Object.assign(state, bounded(state, bounds));
      if (distance(state, goal) < 1.5 && Math.hypot(state.vx, state.vy) < 8) {
        Object.assign(state, goal, { steering: false, vx: 0, vy: 0 });
      }
      return state;
    }
    if (state.reaction) {
      const reaction = state.reaction;
      reaction.elapsed += delta;
      if (reaction.elapsed >= reaction.duration) stopKeeperReaction(state);
      else {
        glide(state, bounded(reaction.goal, bounds), delta, false, { ...swim, speed: Math.min(swim.speed, 110) });
        state.heading = reaction.heading;
        if (Number.isFinite(reaction.heading)) state.facing = Math.cos(reaction.heading) >= 0 ? 1 : -1;
        state.expression = { gesture: reaction.gesture, amount: Math.sin(Math.PI * reaction.elapsed / reaction.duration) };
        Object.assign(state, bounded(state, bounds));
        return state;
      }
    }
    Object.assign(state, bounded(state, bounds), { vx: 0, vy: 0 });
    return state;
  }
  stopKeeperReaction(state);
  if (state.phase === 'returning') {
    glide(state, home, delta, true, movement === 'swim' ? swim : null);
    if (Math.abs(home.x - state.x) > 1) state.facing = home.x > state.x ? 1 : -1;
    if (distance(state, home) < 1.5 && Math.hypot(state.vx, state.vy) < 8)
      Object.assign(state, home, { phase: 'docked', vx: 0, vy: 0 });
    return state;
  }
  if (movement === 'swim') {
    const goal = bounded(state.destination || state, bounds);
    glide(state, goal, delta, false, swim);
    const visible = bounded(state, bounds);
    if (state.x !== visible.x) state.vx = 0;
    if (state.y !== visible.y) state.vy = 0;
    Object.assign(state, visible);
    return state;
  }
  const focus = pointer || home;
  const nextZone = keeperZone(focus, bounds, size), easing = 1 - Math.exp(-delta * 4);
  state.zone.x += (nextZone.x - state.zone.x) * easing;
  state.zone.y += (nextZone.y - state.zone.y) * easing;
  state.waiting = Math.max(0, state.waiting - delta);
  if (!state.wander || state.resting && state.waiting === 0) {
    const angle = random() * Math.PI * 2, radius = 30 + random() * (KEEPER_MOTION.radius - 30);
    state.wander = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * .65 };
    state.resting = false;
  }
  // The local destination moves with the zone, including during a rest.
  // Pointer motion never discards a goal in favour of a random jump.
  let goal = bounded({ x: state.zone.x + state.wander.x, y: state.zone.y + state.wander.y }, bounds);
  const gap = Math.max(KEEPER_MOTION.pointerGap, size / 2 + 40);
  if (pointer && distance(goal, pointer) < gap) {
    const away = Math.atan2(nextZone.y - pointer.y, nextZone.x - pointer.x);
    goal = bounded({ x: pointer.x + Math.cos(away) * gap, y: pointer.y + Math.sin(away) * gap }, bounds);
  }
  glide(state, goal, delta, false);
  const visible = bounded(state, bounds);
  if (state.x !== visible.x) state.vx = 0;
  if (state.y !== visible.y) state.vy = 0;
  Object.assign(state, visible);
  if (!state.resting && distance(state, goal) < 8 && Math.hypot(state.vx, state.vy) < 14) {
    state.resting = true; state.waiting = 1.2 + random() * 2.2;
  }
  if (pointer) faceKeeperPointer(state, pointer);
  else if (Math.abs(state.vx) > 12) state.facing = Math.sign(state.vx);
  return state;
}
