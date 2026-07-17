import assert from 'node:assert/strict';
import test from 'node:test';
import { habitatBoundsEqual, measureRoundedHabitatBounds } from './habitatBounds.js';

test('habitat measurements use the transparent content box and rounded pixels', () => {
  const element = {
    clientLeft: 1,
    clientTop: 2,
    clientWidth: 320,
    clientHeight: 180,
    getBoundingClientRect: () => ({ left: 10.4, top: 20.4 })
  };

  assert.deepEqual(measureRoundedHabitatBounds(element), {
    left: 11,
    top: 22,
    right: 331,
    bottom: 202,
    width: 320,
    height: 180
  });
});

test('equal rounded habitat bounds suppress duplicate reports', () => {
  const bounds = { left: 1, top: 2, right: 3, bottom: 4, width: 2, height: 2 };
  assert.equal(habitatBoundsEqual(bounds, { ...bounds }), true);
  assert.equal(habitatBoundsEqual(bounds, { ...bounds, right: 4 }), false);
  assert.equal(habitatBoundsEqual(null, bounds), false);
});
