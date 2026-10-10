import assert from 'node:assert/strict';
import test from 'node:test';
import { interpolateWorkbenchCamera, restoreWorkbenchCamera, workbenchDestinationCamera, workbenchNavigationViewport } from './workbenchNavigation.js';

test('destinations fit proportionally inside the free viewport without changing logical geometry', () => {
  const bounds = Object.freeze({ left: 700, top: 220, width: 640, height: 360 });
  for (const viewport of [{ left: 0, top: 0, width: 1440, height: 820 }, { left: 12, top: 24, width: 366, height: 700 }]) {
    const camera = workbenchDestinationCamera(bounds, viewport);
    assert.equal((bounds.left + bounds.width / 2) * camera.scale + camera.offset.x, viewport.left + viewport.width / 2);
    assert.equal((bounds.top + bounds.height / 2) * camera.scale + camera.offset.y, viewport.top + viewport.height / 2);
    assert.ok(bounds.width * camera.scale <= viewport.width - 64 + 1e-7);
    assert.ok(bounds.height * camera.scale <= viewport.height - 64 + 1e-7);
  }
});

test('focus retains camera limits and rejects absent or invalid destinations', () => {
  const viewport = { left: 0, top: 0, width: 1000, height: 800 };
  assert.equal(workbenchDestinationCamera({ left: 10, top: 20, width: 50, height: 50 }, viewport).scale, 2);
  assert.equal(workbenchDestinationCamera({ left: 10, top: 20, width: 8000, height: 8000 }, viewport, .4).scale, .4);
  for (const bounds of [null, { left: 0, top: 0, width: 0, height: 20 }, { left: NaN, top: 0, width: 40, height: 20 }])
    assert.equal(workbenchDestinationCamera(bounds, viewport), null);
  assert.equal(workbenchDestinationCamera({ left: 0, top: 0, width: 40, height: 20 }, { ...viewport, height: 0 }), null);
});

test('focus uses the full Workbench width and the actual bottom controls boundary', () => {
  for (const viewport of [{ width: 1440, height: 860 }, { width: 390, height: 800 }]) {
    const controlsTop = viewport.height - 130;
    assert.deepEqual(workbenchNavigationViewport(viewport, controlsTop),
      { left: 0, top: 0, width: viewport.width, height: controlsTop - 8 });
    assert.deepEqual(workbenchNavigationViewport(viewport), { left: 0, top: 0, ...viewport });
    assert.deepEqual(workbenchNavigationViewport(viewport, 2000), { left: 0, top: 0, ...viewport });
    assert.equal(workbenchNavigationViewport(viewport, 4).height, 0);
  }
});

test('camera interpolation reaches exact endpoints without changing either saved context', () => {
  const start = Object.freeze({ scale: .67, offset: Object.freeze({ x: -123.4, y: 56.78 }) });
  const end = Object.freeze({ scale: 2, offset: Object.freeze({ x: -1760, y: -560 }) });
  assert.strictEqual(interpolateWorkbenchCamera(start, end, 0), start);
  assert.strictEqual(interpolateWorkbenchCamera(start, end, 1), end);
  for (const progress of [.1, .5, .9]) {
    const camera = interpolateWorkbenchCamera(start, end, progress);
    assert.ok(camera.scale > start.scale && camera.scale < end.scale);
    assert.ok(camera.offset.x < start.offset.x && camera.offset.x > end.offset.x);
  }
});

test('return restores exactly at the same viewport and retains its world centre after resize', () => {
  const camera = { scale: .73, offset: { x: -92.7, y: 137.4 } };
  const before = { width: 1440, height: 860 }, after = { width: 390, height: 680 };
  assert.deepEqual(restoreWorkbenchCamera(camera, before, before), camera);
  const returned = restoreWorkbenchCamera(camera, before, after);
  for (const [axis, dimension] of [['x', 'width'], ['y', 'height']]) {
    const oldCentre = (before[dimension] / 2 - camera.offset[axis]) / camera.scale;
    const newCentre = (after[dimension] / 2 - returned.offset[axis]) / returned.scale;
    assert.ok(Math.abs(oldCentre - newCentre) < 1e-9);
  }
  assert.deepEqual(camera, { scale: .73, offset: { x: -92.7, y: 137.4 } });
});
