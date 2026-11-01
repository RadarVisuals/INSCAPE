import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG,
  focusViewerPresentationDimensions,
  focusedViewerRectangle,
  normalizeViewerRectangle,
} from './latticeFocusViewer.js';

test('viewer presentation dimensions follow the authored quarter-turn orientation', () => {
  const dimensions = { width: 1200, height: 800 };
  assert.equal(focusViewerPresentationDimensions({ focusDimensions: dimensions }), dimensions);
  assert.deepEqual(focusViewerPresentationDimensions({
    focusDimensions: dimensions,
    placement: { transform: { quarterTurns: 1 } },
  }), { width: 800, height: 1200 });
  assert.deepEqual(focusViewerPresentationDimensions({
    focusDimensions: dimensions,
    placement: { transform: { quarterTurns: 3 } },
  }), { width: 800, height: 1200 });
});

test('focused viewer preserves native presentation ratio and centers within safe viewport margins', () => {
  const origin = { left: 120, top: 80, width: 240, height: 360 };
  const focused = focusedViewerRectangle(origin, { width: 1440, height: 900 });
  assert.ok(Math.abs((focused.width / focused.height) - (origin.width / origin.height)) < Number.EPSILON);
  assert.equal(focused.left + (focused.width / 2), 720);
  assert.equal(focused.top + (focused.height / 2), 450);
  assert.ok(focused.left >= 48);
  assert.ok(focused.top >= 40);
});

test('focused viewer refits deterministically for compact and iframe viewports', () => {
  const origin = { left: 10, top: 20, width: 640, height: 320 };
  const compact = focusedViewerRectangle(origin, { width: 480, height: 320 });
  assert.equal(compact.left + compact.width / 2, 240);
  assert.equal(compact.top + compact.height / 2, 160);
  assert.ok(Math.abs(compact.width - 345.6) < 1e-9);
  assert.ok(Math.abs(compact.width / compact.height - 2) < 1e-12);
});

test('viewer rectangle validation rejects missing, non-finite and zero-sized geometry', () => {
  assert.throws(() => normalizeViewerRectangle(null), /required/);
  assert.throws(() => normalizeViewerRectangle({ left: 0, top: 0, width: 0, height: 1 }), /positive/);
  assert.throws(() => normalizeViewerRectangle({ left: NaN, top: 0, width: 1, height: 1 }), /finite/);
});
