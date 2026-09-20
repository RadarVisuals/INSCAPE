import test from 'node:test';
import assert from 'node:assert/strict';
import { coastGrid } from './gridMomentum.js';

test('momentum slows without reversing and is independent of refresh rate', () => {
  for (const direction of [-1, 1]) {
    const whole = coastGrid(direction * .002, 32);
    const first = coastGrid(direction * .002, 16), second = coastGrid(first.velocity, 16);
    assert.ok(Math.abs(whole.distance - first.distance - second.distance) < 1e-12);
    assert.ok(Math.abs(whole.velocity - second.velocity) < 1e-12);
    assert.equal(Math.sign(whole.distance), direction);
    assert.ok(Math.abs(whole.velocity) < .002);
  }
});
test('momentum comes to rest at a fractional Grid position', () => {
  let velocity = -.001, position = -.23;
  for (let i = 0; i < 300; i++) {
    const step = coastGrid(velocity, 16); position += step.distance; velocity = step.velocity;
  }
  assert.equal(velocity, 0);
  assert.ok(position < -.5 && position > -.6);
  assert.deepEqual(coastGrid(0, 100), { distance: 0, velocity: 0 });
});
