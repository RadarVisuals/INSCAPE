import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LATTICE_PRODUCTION_FOCUS_TRANSITION_MS,
  projectLatticeProductionFocusMediaMotion,
} from './latticeProductionFocusArtworkMotion.js';

test('production focus artwork retains the accepted 420ms geometry duration', () => {
  assert.equal(LATTICE_PRODUCTION_FOCUS_TRANSITION_MS, 420);
});

test('one focus geometry projection preserves rotated media ratio for the entire handoff', () => {
  const placement = {
    crop: { x: 0.42, y: 0.58, zoom: 1.7 },
    mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
    transform: { quarterTurns: 1, mirrorX: false, mirrorY: false },
  };
  const rectangles = [0, 0.2, 0.5, 0.8, 1].map((progress) => projectLatticeProductionFocusMediaMotion(
    placement,
    { width: 800, height: 400 },
    {
      sourceRectangle: { left: 40, top: 70, width: 320, height: 180 },
      focusedRectangle: { left: 420, top: 80, width: 360, height: 540 },
      currentRectangle: { left: 100, top: 90, width: 340, height: 300 },
      progress,
    },
  ).rectangle);
  rectangles.forEach((rectangle) => {
    assert.ok(rectangle.width > 0);
    assert.ok(rectangle.height > 0);
    assert.ok(Math.abs((rectangle.width / rectangle.height) - 2) < 1e-12);
  });
});
