import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeeperMotion, keeperZone, keeperViewport, faceKeeperPointer, releaseKeeper, returnKeeper, stepKeeper, KEEPER_MOTION, moveKeeperTo } from './keeperMotion.js';
import { KEEPER_SWIM_DEFAULTS } from './keeperSwim.js';
const bounds = { left: 72, top: 96, right: 1368, bottom: 880 };
const home = { x: 100, y: 120 };
const run = (state, steps, input = {}) => { for (let i = 0; i < steps; i++) stepKeeper(state, { dt: 1 / 60, bounds, home, pointer: { x: 500, y: 500 }, random: () => .4, ...input }); };

test('conversation holds position and heading, keeps idle time, and resumes the existing swim destination', () => {
  const state = createKeeperMotion({ x: 400, y: 400 }); releaseKeeper(state);
  moveKeeperTo(state, { x: 1100, y: 600 }); run(state, 30, { movement: 'swim' });
  const before = { ...state };
  run(state, 120, { movement: 'swim', paused: true });
  assert.equal(state.x, before.x); assert.equal(state.y, before.y); assert.equal(state.heading, before.heading);
  assert.equal(state.vx, 0); assert.ok(state.elapsed > before.elapsed);
  run(state, 600, { movement: 'swim' });
  assert.ok(Math.hypot(state.x - 1100, state.y - 600) < 1);
  returnKeeper(state); run(state, 600, { movement: 'swim', paused: true });
  assert.equal(state.phase, 'docked', 'recall can always interrupt a conversation');
});
test('Swimming follows explicit destinations, ignores pointer hover, brakes and recalls through the same flight model', () => {
  const state = createKeeperMotion(home); releaseKeeper(state);
  moveKeeperTo(state, { x: 1000, y: 700 });
  run(state, 120, { movement: 'swim' });
  const velocity = { x: state.vx, y: state.vy };
  moveKeeperTo(state, { x: 350, y: 300 }); run(state, 1, { movement: 'swim' });
  assert.ok(Math.hypot(state.vx - velocity.x, state.vy - velocity.y) <= KEEPER_SWIM_DEFAULTS.speed * 3 / 60 + .001);
  run(state, 900, { movement: 'swim', pointer: { x: 1350, y: 800 } });
  assert.ok(Math.hypot(state.x - 350, state.y - 300) < .01);
  assert.ok(Math.hypot(state.vx, state.vy) < .01);
  moveKeeperTo(state, { x: -1000, y: 3000 }); run(state, 900, { movement: 'swim' });
  assert.ok(Math.abs(state.x - bounds.left) < .01 && Math.abs(state.y - bounds.bottom) < .01);
  returnKeeper(state); run(state, 900, { movement: 'swim' });
  assert.equal(state.phase, 'docked'); assert.equal(state.x, home.x); assert.equal(state.y, home.y);
});
test('Swim speed controls travel and recall, live edits brake smoothly, and the head receives a turn before velocity reverses', () => {
  const start = { x: 400, y: 400 }, destination = { x: 1300, y: 400 };
  const slow = createKeeperMotion(start), fast = createKeeperMotion(start);
  for (const state of [slow, fast]) { releaseKeeper(state); moveKeeperTo(state, destination); }
  const slowTuning = { ...KEEPER_SWIM_DEFAULTS, speed: 100 }, fastTuning = { ...KEEPER_SWIM_DEFAULTS, speed: 700 };
  run(slow, 60, { movement: 'swim', swim: slowTuning }); run(fast, 60, { movement: 'swim', swim: fastTuning });
  assert.ok(fast.x - start.x > 3 * (slow.x - start.x));
  const before = { ...fast };
  run(fast, 1, { movement: 'swim', swim: slowTuning });
  assert.ok(Math.hypot(fast.vx - before.vx, fast.vy - before.vy) <= 100 * 3 / 60 + .001);
  assert.ok(fast.vx > 100, 'lowering the speed does not discard velocity');
  moveKeeperTo(fast, start); run(fast, 1, { movement: 'swim', swim: fastTuning });
  assert.ok(fast.vx > 0, 'still travelling right from inertia');
  assert.ok(Math.abs(Math.abs(fast.heading) - Math.PI) < .001, 'head already sees the destination to the left');
  for (const [speed, state] of [[100, slow], [700, fast]]) {
    Object.assign(state, { x: 1200, y: 400, vx: 0, vy: 0 }); returnKeeper(state);
    run(state, 60, { movement: 'swim', swim: { ...KEEPER_SWIM_DEFAULTS, speed }, home: start });
  }
  assert.ok(fast.x < slow.x - 200, 'recall also uses the speed control');
  const original = createKeeperMotion(start), withSwimSettings = createKeeperMotion(start);
  releaseKeeper(original); releaseKeeper(withSwimSettings);
  run(original, 300); run(withSwimSettings, 300, { swim: fastTuning });
  assert.deepEqual(original, withSwimSettings, 'Flip ignores layered controls');
});
test('Keeper drifts toward an offset zone, pauses and does not attach to the pointer', () => {
  const state = createKeeperMotion(home); releaseKeeper(state); run(state, 2400);
  const zone = keeperZone({ x: 500, y: 500 }, bounds);
  assert.ok(Math.hypot(state.x - zone.x, state.y - zone.y) <= KEEPER_MOTION.radius);
  assert.ok(Math.hypot(state.x - 500, state.y - 500) >= KEEPER_MOTION.pointerGap - 10);
  let paused = false; for (let i = 0; i < 600; i++) { run(state, 1); if (state.waiting > 1) paused = true; }
  assert.ok(paused); const before = { ...state }, pointer = { x: 900, y: 600 }, targetZone = keeperZone(pointer, bounds);
  before.zone = { ...state.zone }; run(state, 1, { pointer });
  assert.ok(Math.hypot(state.zone.x - before.zone.x, state.zone.y - before.zone.y)
    < Math.hypot(targetZone.x - before.zone.x, targetZone.y - before.zone.y), 'zone approaches the pointer smoothly');
  assert.ok(Math.hypot(state.x - before.x, state.y - before.y) <= KEEPER_MOTION.maxSpeed / 60, 'pointer jump cannot teleport the creature');
});
test('Movement remains visible at narrow edges, faces the pointer and returns to a moved dock', () => {
  const state = createKeeperMotion({ x: 900, y: 400 }); releaseKeeper(state);
  run(state, 120, { pointer: { x: 100, y: 400 } }); assert.equal(state.facing, -1);
  run(state, 1200, { bounds: { left: 72, top: 96, right: 318, bottom: 720 }, pointer: { x: 380, y: 10 } });
  assert.ok(state.x >= 72 && state.x <= 318 && state.y >= 96 && state.y <= 720);
  returnKeeper(state); run(state, 600, { home: { x: 240, y: 200 } });
  assert.equal(state.phase, 'docked'); assert.equal(state.x, 240); assert.equal(state.y, 200);
});
test('A long suspended frame cannot jump across the screen', () => {
  const state = createKeeperMotion(home); releaseKeeper(state);
  stepKeeper(state, { dt: 100, home, bounds, pointer: { x: 1200, y: 800 }, random: () => .5 });
  assert.ok(Math.hypot(state.x - home.x, state.y - home.y) < 10);
});

test('Pointer crossings change facing immediately while resting or travelling in the other direction', () => {
  const state = createKeeperMotion({ x: 500, y: 400 }); releaseKeeper(state);
  state.vx = 100; state.resting = true; state.waiting = 10;
  faceKeeperPointer(state, { x: 499.9, y: 800 }); assert.equal(state.facing, -1);
  faceKeeperPointer(state, { x: 500.1, y: 10 }); assert.equal(state.facing, 1);
  faceKeeperPointer(state, { x: 500, y: 10 }); assert.equal(state.facing, 1);
  assert.equal(state.waiting, 10); assert.equal(state.x, 500, 'attention does not teleport the creature');
});

test('Small pointer changes move the zone during a pause without selecting a random new destination', () => {
  const pointer = { x: 500, y: 500 }, zone = keeperZone(pointer, bounds);
  const state = createKeeperMotion(zone); releaseKeeper(state);
  Object.assign(state, { wander: { x: 0, y: 0 }, resting: true, waiting: 2 });
  run(state, 1, { pointer: { x: 510, y: 500 }, random: () => { throw Error('Unexpected random retarget'); } });
  assert.ok(state.zone.x > zone.x); assert.ok(state.x > zone.x);
  assert.deepEqual(state.wander, { x: 0, y: 0 }); assert.ok(state.waiting > 1);
});

test('Pointer reversals and recall retain velocity with bounded acceleration, and refresh rate does not change the path', () => {
  const state = createKeeperMotion({ x: 500, y: 400 }); releaseKeeper(state); run(state, 100);
  const before = { ...state };
  run(state, 1, { pointer: { x: 100, y: 200 } });
  assert.ok(Math.hypot(state.vx - before.vx, state.vy - before.vy) <= KEEPER_MOTION.maxAcceleration / 60 + .001);
  const velocity = { x: state.vx, y: state.vy }; returnKeeper(state); run(state, 1);
  assert.ok(Math.hypot(state.vx - velocity.x, state.vy - velocity.y) <= KEEPER_MOTION.maxAcceleration / 60 + .001);
  const simulate = hz => {
    const value = createKeeperMotion({ x: 500, y: 400 }); releaseKeeper(value);
    for (let frame = 0; frame < hz * 3; frame++) run(value, 1, { dt: 1 / hz, pointer: { x: 700, y: 600 } });
    return value;
  };
  const slow = simulate(30), fast = simulate(120);
  assert.ok(Math.hypot(slow.x - fast.x, slow.y - fast.y) < 3);
});

test('Large Keepers fit narrow viewports with room for a perspective flip without changing authored size', () => {
  const wide = keeperViewport(384, 1440, 1000), narrow = keeperViewport(384, 390, 844);
  assert.equal(wide.size, 384); assert.ok(narrow.size < 384);
  assert.ok(narrow.bounds.left >= narrow.size / 2 && narrow.bounds.right <= 390 - narrow.size / 2);
  const state = createKeeperMotion({ x: 200, y: 300 }); releaseKeeper(state);
  run(state, 1200, { ...narrow, pointer: { x: 0, y: 0 } });
  assert.ok(state.x >= narrow.bounds.left && state.x <= narrow.bounds.right);
});
