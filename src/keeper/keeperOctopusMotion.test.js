import test from 'node:test';
import assert from 'node:assert/strict';
import { readOctopusPath, octopusPath } from './keeperOctopusRig.js';
import { createKeeperOctopusPose, stepKeeperOctopusPose, OCTOPUS_DROP_LIMIT } from './keeperOctopusMotion.js';
import { KEEPER_SWIM_DEFAULTS } from './keeperSwim.js';

const commands = readOctopusPath('M-30 0 C-30 60 -10 200 0 200 C10 200 30 60 30 0 Z');
const aperture = { commands: readOctopusPath('M-20 -10 C-10 -20 10 -20 20 -10 C10 10 -10 10 -20 -10 Z') };
aperture.d = octopusPath(aperture.commands);
const rig = { tentacles: Array.from({ length: 5 }, (_, i) => ({ id: `tentacle-${i + 1}`, root: { x: i * 20, y: 0 }, tip: { x: i * 20, y: 200 }, commands, d: octopusPath(commands) })),
  eyes: Array.from({ length: 3 }, () => ({ aperture, center: { x: 0, y: -5 }, bounds: { left: -20, top: -20, right: 20, bottom: 10 } })) };
const motion = { x: 500, y: 400, vx: 0, vy: 0, heading: 0 };

test('Only bounded, closed absolute curve data is accepted', () => {
  assert.equal(readOctopusPath(octopusPath(commands)).length, 4);
  for (const invalid of ['M0 0 C1 2 Z', 'M0 0 L2 Infinity Z', 'M0 0 L2 3Z<script>', 'M0 0L2 3', 'M0 0l2 3Z', 'M0 0L999999 3Z', 'M0 0' + 'L1 1'.repeat(300) + 'Z'])
    assert.throws(() => readOctopusPath(invalid));
});

test('Idle bends independently, looks toward the pointer and closes/reopens all three eyes', () => {
  const pose = createKeeperOctopusPose(rig), min = [1,1,1], max = [0,0,0];
  for (let frame = 0; frame < 600; frame++) {
    stepKeeperOctopusPose(pose, rig, motion, 1 / 60, { pointer: { x: 800, y: 300 } });
    pose.eyes.forEach((eye, i) => { min[i] = Math.min(min[i], eye.blink); max[i] = Math.max(max[i], eye.blink); });
  }
  assert.ok(pose.tentacles.every(t => t.d !== octopusPath(commands)));
  assert.equal(new Set(pose.tentacles.map(t => t.d)).size, 5);
  assert.ok(pose.eyes.every(eye => eye.x > 0 && eye.y < 0));
  assert.ok(max.every(n => n > .99) && min.every(n => n === 0));
  assert.ok(pose.history.length < 125);
});

test('Detached goo falls in screen space while the head moves/turns; particles remain bounded', () => {
  const pose = createKeeperOctopusPose(rig);
  for (let i = 0; i < 96; i++) stepKeeperOctopusPose(pose, rig, motion, 1 / 60, { size: 384 });
  const drop = pose.drops[0]; assert.ok(drop);
  const x = drop.x, y = drop.y;
  stepKeeperOctopusPose(pose, rig, { ...motion, x: 800, heading: Math.PI }, .016, { size: 384 });
  assert.ok(Math.abs(drop.x - x) < 1 && drop.y > y);
  assert.equal(drop.localX, (drop.x - 800) * 1000 / 384);
  for (let i = 0; i < 1800; i++) {
    stepKeeperOctopusPose(pose, rig, { ...motion, heading: Math.sin(i / 80) * Math.PI, vx: 400 }, 1 / 60);
    assert.ok(pose.drops.length <= OCTOPUS_DROP_LIMIT);
    assert.ok(pose.tentacles.every(t => !/NaN|Infinity/.test(t.d)));
  }
});

test('Reduced motion restores the authored pose and clears particles; tuning controls head and gathering response', () => {
  const fast = createKeeperOctopusPose(rig), slow = createKeeperOctopusPose(rig);
  for (let i = 0; i < 30; i++) {
    stepKeeperOctopusPose(fast, rig, { ...motion, vx: 420, heading: 1 }, 1 / 60, { swim: { ...KEEPER_SWIM_DEFAULTS, turnSeconds: .1, gatherSeconds: .1 } });
    stepKeeperOctopusPose(slow, rig, { ...motion, vx: 420, heading: 1 }, 1 / 60, { swim: { ...KEEPER_SWIM_DEFAULTS, turnSeconds: 2, gatherSeconds: 3 } });
  }
  assert.ok(fast.angle > slow.angle && fast.compression > slow.compression);
  fast.drops.push({ life: 0 });
  stepKeeperOctopusPose(fast, rig, motion, 10, { reducedMotion: true });
  assert.equal(fast.angle, 0); assert.equal(fast.drops.length, 0);
  assert.ok(fast.tentacles.every(t => t.d === octopusPath(commands)));
  assert.ok(fast.eyes.every(eye => eye.d === aperture.d && eye.x === 0));
});
