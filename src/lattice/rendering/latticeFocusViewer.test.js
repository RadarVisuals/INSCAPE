import test from 'node:test';
import assert from 'node:assert/strict';

import {
  focusedViewerRectangle,
  normalizeViewerRectangle,
  viewerTransform,
} from './latticeFocusViewer.js';

test('focused viewer preserves native presentation ratio and centers within safe viewport margins', () => {
  const origin = { left: 120, top: 80, width: 240, height: 360 };
  const focused = focusedViewerRectangle(origin, { width: 1440, height: 900 });
  assert.equal(focused.width / focused.height, origin.width / origin.height);
  assert.equal(focused.left + (focused.width / 2), 720);
  assert.equal(focused.top + (focused.height / 2), 450);
  assert.ok(focused.left >= 48);
  assert.ok(focused.top >= 40);
});

test('focused viewer refits deterministically for compact and iframe viewports', () => {
  const origin = { left: 10, top: 20, width: 640, height: 320 };
  const compact = focusedViewerRectangle(origin, { width: 480, height: 320 });
  assert.deepEqual(compact, { left: 48, top: 64, width: 384, height: 192 });
});

test('viewer transform returns the origin representation to an exact live destination', () => {
  const origin = { left: 100, top: 140, width: 200, height: 100 };
  const destination = { left: 400, top: 300, width: 500, height: 250 };
  assert.deepEqual(viewerTransform(origin, destination), { x: 450, y: 235, scale: 2.5 });
  assert.deepEqual(viewerTransform(origin, origin), { x: 0, y: 0, scale: 1 });
});

test('viewer rectangle validation rejects missing, non-finite and zero-sized geometry', () => {
  assert.throws(() => normalizeViewerRectangle(null), /required/);
  assert.throws(() => normalizeViewerRectangle({ left: 0, top: 0, width: 0, height: 1 }), /positive/);
  assert.throws(() => normalizeViewerRectangle({ left: NaN, top: 0, width: 1, height: 1 }), /finite/);
});
