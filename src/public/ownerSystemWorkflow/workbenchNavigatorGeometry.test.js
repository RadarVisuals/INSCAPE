import test from 'node:test';
import assert from 'node:assert/strict';
import { navigatorBounds, navigatorCentre, navigatorFrame, navigatorViewport } from './workbenchNavigatorGeometry.js';
test('minimap round trips a nonzero canvas and camera without changing its proportions', () => {
  const camera = { scale: .75, offset: { x: 210, y: -480 } }, viewport = { width: 900, height: 600 };
  const visible = navigatorViewport(camera, viewport);
  const bounds = navigatorBounds([{ left: -1000, top: 250, width: 2000, height: 3000 }, visible], { width: 150, height: 85 });
  const frame = navigatorFrame(visible, bounds), centre = navigatorCentre(frame.view, bounds);
  assert.ok(Math.abs(centre.x - visible.left - visible.width / 2) < 1e-8);
  assert.ok(Math.abs(centre.y - visible.top - visible.height / 2) < 1e-8);
  assert.ok(Math.abs(bounds.width / bounds.height - 150 / 85) < 1e-8);
  assert.ok(frame.frameSize.width <= 100 && frame.frameSize.height <= 100);
});
test('empty and extreme extents are bounded without NaN or an invented origin', () => {
  assert.equal(navigatorBounds([], { width: 150, height: 85 }), null);
  const area = { left: -16384, top: -16384, width: 1, height: 1 };
  const bounds = navigatorBounds([area, { left: 50000, top: 30000, width: 1, height: 1 }], { width: 120, height: 85 });
  assert.ok(Object.values(bounds).every(Number.isFinite));
  assert.ok(bounds.left < area.left && bounds.top < area.top);
  assert.ok(bounds.left + bounds.width > 50000);
});
