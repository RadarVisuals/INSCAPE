import { mapOctopusPath, octopusPath } from './keeperOctopusRig.js';
import { KEEPER_SWIM_DEFAULTS } from './keeperSwim.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const turn = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const rotate = (p, a) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });
export const OCTOPUS_DROP_LIMIT = 8;
export function createKeeperOctopusPose(rig) {
  return { elapsed: 0, angle: 0, headAngle: 0, scaleX: 1, compression: 0, history: [{ time: 0, angle: 0 }], drops: [], serial: 0,
    tentacles: rig.tentacles.map((t, i) => ({ d: t.d, tip: t.tip, nextDrop: 1.5 + i * .87 })),
    eyes: rig.eyes.map((eye, i) => ({ d: eye.aperture.d, x: 0, y: 0, blink: 0, nextBlink: 1.7 + i * 1.15, blinkStart: -10 })) };
}

function bendTentacle(tentacle, { elapsed, compression, lag, formation, index, faces, surprised, rear = faces === 'left' ? 0 : Math.PI, trail = false, fanCenter }) {
  const root = tentacle.root, tip = tentacle.tip;
  const length = Math.hypot(tip.x - root.x, tip.y - root.y), angle = Math.atan2(tip.y - root.y, tip.x - root.x);
  const axis = { x: Math.cos(angle), y: Math.sin(angle) }, normal = { x: -axis.y, y: axis.x };
  const fanRear = trail && Number.isFinite(fanCenter) ? rear + turn(fanCenter, angle) : rear;
  const bend = (trail ? turn(angle, fanRear) * .95 : clamp(turn(angle, rear), -1.2, 1.2) * .72) * compression + clamp(lag, -.6, .6);
  const bones = [{ ...root, angle }], steps = 12;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const wave = Math.sin(elapsed * (1.8 + index * .09) - t * 4.4 + index * 1.7) * (.12 + .05 * (1 - compression));
    const heading = trail
      ? angle + bend * (.65 + .35 * t) + (wave + Math.sin(index * 2) * surprised * .24) * t
      : angle + (bend + wave + Math.sin(index * 2) * surprised * .24) * t;
    const distance = length / steps * (1 + compression * .06 + formation * .06 * t ** 3);
    const prev = bones.at(-1);
    bones.push({ x: prev.x + Math.cos(heading) * distance, y: prev.y + Math.sin(heading) * distance, angle: heading });
  }
  const map = (x, y) => {
    const dx = x - root.x, dy = y - root.y;
    const t = (dx * axis.x + dy * axis.y) / length, i = clamp(Math.floor(t * steps), 0, steps - 1);
    const f = t * steps - i, a = bones[i], b = bones[i + 1], heading = a.angle + (b.angle - a.angle) * f;
    const lateral = (dx * normal.x + dy * normal.y) * (1 + formation * .18 * clamp(t, 0, 1) ** 5);
    return [a.x + (b.x - a.x) * f - Math.sin(heading) * lateral, a.y + (b.y - a.y) * f + Math.cos(heading) * lateral];
  };
  return { d: octopusPath(mapOctopusPath(tentacle.commands, map)), tip: bones.at(-1) };
}

// Uses the dock's single clock. Drops retain screen coordinates after release,
// so head turns and travel cannot rotate gravity or drag detached goo along.
export function stepKeeperOctopusPose(pose, rig, motion, dt, { faces = 'right', reducedMotion = false, swim = KEEPER_SWIM_DEFAULTS, size = 192, pointer = null, orientation = null } = {}) {
  if (reducedMotion) {
    Object.assign(pose, createKeeperOctopusPose(rig));
    return pose;
  }
  const delta = clamp(dt, 0, .05);
  if (!delta) return pose;
  pose.elapsed += delta;
  const speed = Math.hypot(motion.vx || 0, motion.vy || 0), target = Math.min(1, speed / swim.speed);
  pose.compression += (target - pose.compression) * (1 - Math.exp(-delta * Math.LN10 / (target > pose.compression ? swim.gatherSeconds : swim.spreadSeconds)));
  const heading = motion.heading;
  const targetAngle = orientation?.angle ?? (Number.isFinite(heading) ? heading - (faces === 'left' ? Math.PI : 0) : pose.angle);
  pose.angle += turn(pose.angle, targetAngle) * (1 - Math.exp(-delta * Math.LN10 / swim.turnSeconds));
  pose.scaleX = orientation?.scaleX ?? 1;
  pose.history.push({ time: pose.elapsed, angle: pose.angle });
  while (pose.history.length > 2 && pose.history[1].time < pose.elapsed - 2) pose.history.shift();
  const surprised = motion.expression?.gesture === 'startled' ? motion.expression.amount : 0;
  const tilt = motion.expression?.gesture === 'curious' ? motion.expression.amount * .18 : 0;
  pose.headAngle = pose.angle + tilt;
  pose.tentacles.forEach((state, i) => {
    const delay = (i + 1) * swim.staggerSeconds;
    const previous = pose.history.find(h => h.time >= pose.elapsed - delay) || pose.history[0];
    const formation = clamp(1 - (state.nextDrop - pose.elapsed) / .65, 0, 1);
    const bent = bendTentacle(rig.tentacles[i], { elapsed: pose.elapsed, compression: pose.compression,
      lag: turn(pose.angle, previous.angle), formation, index: i, faces, surprised,
      rear: Number.isFinite(orientation?.rearWorld) ? orientation.rearWorld - pose.headAngle : orientation?.rear,
      trail: orientation?.trail, fanCenter: orientation?.fanCenter });
    state.d = bent.d; state.localTip = bent.tip; state.tip = rotate({ x: bent.tip.x * pose.scaleX, y: bent.tip.y }, pose.headAngle);
    if (pose.elapsed >= state.nextDrop) {
      state.nextDrop = pose.elapsed + 3.8 + i * .43 + Math.sin(pose.elapsed + i) * .6;
      if (pose.drops.length < OCTOPUS_DROP_LIMIT) pose.drops.push({ id: pose.serial++, life: 0,
        x: motion.x + state.tip.x * size / 1000, y: motion.y + state.tip.y * size / 1000,
        vx: clamp((motion.vx || 0) * .22, -150, 150), vy: Math.max(12, (motion.vy || 0) * .16),
        radius: Math.max(1.2, size * .009), duration: 1.05 });
    }
  });
  pose.drops = pose.drops.filter(drop => {
    drop.life += delta; drop.vy += 230 * delta; drop.x += drop.vx * delta; drop.y += drop.vy * delta;
    drop.localX = (drop.x - motion.x) * 1000 / size; drop.localY = (drop.y - motion.y) * 1000 / size;
    drop.opacity = clamp((drop.duration - drop.life) / .35, 0, 1);
    return drop.life < drop.duration;
  });
  const look = pointer ? rotate({ x: (pointer.x - motion.x) * 1000 / size, y: (pointer.y - motion.y) * 1000 / size }, -pose.headAngle) : null;
  if (look) look.x /= (pose.scaleX < 0 ? -1 : 1) * Math.max(.25, Math.abs(pose.scaleX));
  pose.eyes.forEach((state, i) => {
    const eye = rig.eyes[i], width = eye.bounds.right - eye.bounds.left, height = eye.bounds.bottom - eye.bounds.top;
    const drift = Math.sin(Math.floor(pose.elapsed / 2.7) * 2.13 + i * .4);
    const dx = look ? look.x - eye.center.x : drift * 160, dy = look ? look.y - eye.center.y : Math.sin(pose.elapsed * .29 + i) * 80;
    const norm = Math.max(120, Math.hypot(dx, dy));
    const factor = 1 - Math.exp(-delta * 9);
    state.x += (dx / norm * width * .13 - state.x) * factor;
    state.y += (dy / norm * height * .10 - state.y) * factor;
    if (pose.elapsed >= state.nextBlink) {
      state.blinkStart = pose.elapsed;
      state.nextBlink = pose.elapsed + 3.2 + i * 1.1 + .8 * (1 + Math.sin(pose.elapsed * 1.7 + i));
    }
    const age = pose.elapsed - state.blinkStart, duration = i === 2 ? .32 : .25;
    state.blink = age >= 0 && age < duration ? Math.sin(Math.PI * age / duration) ** .65 : 0;
    const meeting = eye.center.y + height * .08;
    state.d = octopusPath(mapOctopusPath(eye.aperture.commands, (x, y) => [x, meeting + (y - meeting) * (1 - state.blink * .998)]));
  });
  return pose;
}
