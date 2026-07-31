import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LATTICE_MARQUEE_SELECTION_MODES,
  latticeMarqueeIntersects,
  latticeMarqueeRectangle,
  resolveLatticeMarqueeSelection,
} from './latticeProductionMarqueeSelection.js';

test('marquee rectangle normalizes every pointer direction', () => {
  assert.deepEqual(latticeMarqueeRectangle({ x: 90, y: 70 }, { x: 20, y: 10 }), {
    left: 20, top: 10, width: 70, height: 60,
  });
});

test('marquee hit testing requires positive overlap and includes partial placements', () => {
  const placement = { left: 20, top: 20, width: 30, height: 30 };
  assert.equal(latticeMarqueeIntersects({ left: 0, top: 0, width: 25, height: 25 }, placement), true);
  assert.equal(latticeMarqueeIntersects({ left: 0, top: 0, width: 20, height: 20 }, placement), false);
  assert.equal(latticeMarqueeIntersects({ left: 51, top: 20, width: 10, height: 10 }, placement), false);
});

test('marquee selection supports replacement, addition, and deterministic toggling', () => {
  assert.deepEqual(resolveLatticeMarqueeSelection(['a'], ['b', 'c'], LATTICE_MARQUEE_SELECTION_MODES.REPLACE), ['b', 'c']);
  assert.deepEqual(resolveLatticeMarqueeSelection(['a', 'b'], ['b', 'c'], LATTICE_MARQUEE_SELECTION_MODES.ADD), ['a', 'b', 'c']);
  assert.deepEqual(resolveLatticeMarqueeSelection(['a', 'b'], ['b', 'c'], LATTICE_MARQUEE_SELECTION_MODES.TOGGLE), ['a', 'c']);
});
