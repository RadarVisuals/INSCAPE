import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPlacementGesture,
  finishPlacementGesture,
  nudgePlacementByPixels,
  updatePlacementGesture,
} from './latticePlacementAuthoring.js';

const placement = {
  id: 'placement-a', x: 0.2, y: 0.3, width: 0.25, height: 0.4,
};
const artboard = { width: 1600, height: 900 };

test('pointer capture may begin before the dead zone without mutating preview geometry', () => {
  const start = createPlacementGesture(placement, { x: 100, y: 100 });
  const click = updatePlacementGesture(start, { x: 105, y: 105 }, artboard, 10);
  assert.equal(click.activated, false);
  assert.deepEqual(click.previewBounds, { x: 0.2, y: 0.3, width: 0.25, height: 0.4 });
  assert.deepEqual(finishPlacementGesture(click), {
    committed: false,
    bounds: { x: 0.2, y: 0.3, width: 0.25, height: 0.4 },
  });
});

test('free placement movement is normalized, continuous, and not grid quantized', () => {
  const start = createPlacementGesture(placement, { x: 100, y: 100 });
  const moved = updatePlacementGesture(start, { x: 223, y: 177 }, artboard, 10);
  assert.equal(moved.activated, true);
  assert.deepEqual(moved.previewBounds, {
    x: 0.276875,
    y: 0.38555555555555554,
    width: 0.25,
    height: 0.4,
  });
  assert.equal(finishPlacementGesture(moved).committed, true);
});

test('transient previews clamp to the complete canonical artboard bounds', () => {
  const start = createPlacementGesture(placement, { x: 100, y: 100 });
  const upperLeft = updatePlacementGesture(start, { x: -10000, y: -10000 }, artboard, 10);
  assert.deepEqual(upperLeft.previewBounds, { x: 0, y: 0, width: 0.25, height: 0.4 });
  const lowerRight = updatePlacementGesture(start, { x: 10000, y: 10000 }, artboard, 10);
  assert.deepEqual(lowerRight.previewBounds, { x: 0.75, y: 0.6, width: 0.25, height: 0.4 });
});

test('Escape-style cancellation restores the exact starting normalized bounds', () => {
  const moved = updatePlacementGesture(
    createPlacementGesture(placement, { x: 100, y: 100 }),
    { x: 900, y: 500 },
    artboard,
    10,
  );
  assert.deepEqual(finishPlacementGesture(moved, { cancelled: true }), {
    committed: false,
    bounds: { x: 0.2, y: 0.3, width: 0.25, height: 0.4 },
  });
});

test('keyboard nudges are screen-space based and remain artboard bounded', () => {
  assert.deepEqual(nudgePlacementByPixels(placement, { x: 1, y: -10 }, artboard), {
    x: 0.200625,
    y: 0.28888888888888886,
    width: 0.25,
    height: 0.4,
  });
  assert.deepEqual(nudgePlacementByPixels(
    { ...placement, x: 0.75, y: 0 },
    { x: 10, y: -10 },
    artboard,
  ), { x: 0.75, y: 0, width: 0.25, height: 0.4 });
});

test('authoring rejects placement bounds that begin or end outside the artboard', () => {
  assert.throws(
    () => createPlacementGesture({ ...placement, x: -0.01 }, { x: 0, y: 0 }),
    /finite normalized bounds/,
  );
  assert.throws(
    () => createPlacementGesture({ ...placement, x: 0.8 }, { x: 0, y: 0 }),
    /finite normalized bounds/,
  );
});
