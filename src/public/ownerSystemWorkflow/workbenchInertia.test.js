import assert from 'node:assert/strict';
import test from 'node:test';
import { workbenchPanCoast, workbenchPanVelocity } from './workbenchInertia.js';

test('release velocity ignores stale, stationary and invalid movement and caps diagonal flings', () => {
  const sample = [{ x: 0, y: 0, time: 0 }, { x: 60, y: 30, time: 60 }];
  assert.deepEqual(workbenchPanVelocity(sample, 64), { x: 1, y: .5 });
  assert.deepEqual(workbenchPanVelocity(sample, 200), { x: 0, y: 0 });
  assert.deepEqual(workbenchPanVelocity([], 200), { x: 0, y: 0 });
  assert.deepEqual(workbenchPanVelocity([{ x: 1, y: 1, time: 1 }, { x: 2, y: 2, time: 1 }], 1), { x: 0, y: 0 });
  const fast = workbenchPanVelocity([{ x: 0, y: 0, time: 0 }, { x: 500, y: 500, time: 20 }], 20);
  assert.ok(Math.abs(Math.hypot(fast.x, fast.y) - 2.5) < 1e-10);
  assert.equal(fast.x, fast.y);
});

test('coasting preserves scale, is bounded and reaches the same position at any refresh rate', () => {
  const camera = Object.freeze({ scale: .75, offset: Object.freeze({ x: -90, y: 140 }) });
  const velocity = Object.freeze({ x: 1.25, y: -.6 });
  const coast = workbenchPanCoast(camera, velocity);
  assert.deepEqual(coast.at(0), camera);
  assert.deepEqual(coast.at(10000), coast.end);
  for (const hz of [30, 60, 120, 144]) {
    let previous = camera;
    for (let elapsed = 0; elapsed <= coast.duration; elapsed += 1000 / hz) {
      const next = coast.at(elapsed);
      assert.equal(next.scale, camera.scale); assert.ok(next.offset.x >= previous.offset.x); assert.ok(next.offset.y <= previous.offset.y);
      previous = next;
    }
    // Analytic integration has no accumulated per-frame rounding or decay.
    const halfSecond = coast.at((500 / (1000 / hz)) * (1000 / hz));
    assert.ok(Math.abs(halfSecond.offset.x - coast.at(500).offset.x) < 1e-10);
  }
  assert.ok(coast.duration <= 700);
  assert.ok(Math.hypot(coast.end.offset.x - camera.offset.x, coast.end.offset.y - camera.offset.y) < 450);
  for (const velocity of [null, { x: NaN, y: 0 }, { x: Infinity, y: 1 }, { x: 0, y: 0 }, { x: .01, y: .01 }]) assert.equal(workbenchPanCoast(camera, velocity), null);
});
