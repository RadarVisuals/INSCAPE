import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createArtboardFramingGesture,
  finishArtboardFramingGesture,
  updateArtboardFramingGesture,
} from './latticeArtboardFraming.js';

test('content follows the pointer only on axes with cover overflow', () => {
  const gesture = createArtboardFramingGesture({ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 80 });
  const moved = updateArtboardFramingGesture(gesture, { x: 150, y: 140 }, { x: 0, y: 80 }, 10);
  assert.equal(moved.activated, true);
  assert.deepEqual(moved.previewOffset, { x: 0, y: 40 });
});

test('framing is hard bounded and has no inertial or settling state', () => {
  const gesture = createArtboardFramingGesture({ x: 20, y: -10 }, { x: 0, y: 0 }, { x: 120, y: 0 });
  const moved = updateArtboardFramingGesture(gesture, { x: -1000, y: 500 }, { x: 120, y: 0 }, 10);
  assert.deepEqual(moved.previewOffset, { x: -120, y: 0 });
  assert.deepEqual(finishArtboardFramingGesture(moved), { committed: true, offset: { x: -120, y: 0 } });
  assert.equal('velocity' in moved, false);
});

test('sub-dead-zone release is selection-neutral and Escape restores the exact start', () => {
  const gesture = createArtboardFramingGesture({ x: 12, y: -8 }, { x: 100, y: 100 }, { x: 20, y: 20 });
  const click = updateArtboardFramingGesture(gesture, { x: 104, y: 103 }, { x: 20, y: 20 }, 10);
  assert.deepEqual(finishArtboardFramingGesture(click), { committed: false, offset: { x: 12, y: -8 } });
  const moved = updateArtboardFramingGesture(gesture, { x: 150, y: 160 }, { x: 20, y: 20 }, 10);
  assert.deepEqual(finishArtboardFramingGesture(moved, { cancelled: true }), {
    committed: false,
    offset: { x: 12, y: -8 },
  });
});

test('framing rejects invalid points, bounds, and dead zones', () => {
  assert.throws(() => createArtboardFramingGesture({}, {}, { x: 0, y: 0 }), /finite pointer/);
  assert.throws(() => createArtboardFramingGesture({}, { x: 0, y: 0 }, { x: -1, y: 0 }), /overflow bounds/);
  assert.throws(() => updateArtboardFramingGesture(
    createArtboardFramingGesture({}, { x: 0, y: 0 }, { x: 0, y: 0 }),
    { x: 1, y: 1 },
    { x: 0, y: 0 },
    -1,
  ), /dead zone/);
});
