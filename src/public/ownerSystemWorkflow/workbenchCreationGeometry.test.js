import test from 'node:test';
import assert from 'node:assert/strict';
import { sameCreationCamera, workbenchCreationPlacement } from './workbenchCreationGeometry.js';

test('rectangle drawing removes camera pan and zoom in both drag directions', () => {
  const camera = { scale: .5, offset: { x: 50, y: -20 } };
  const forward = workbenchCreationPlacement({ x: 100, y: 30 }, { x: 250, y: 130 }, camera, true);
  assert.deepEqual(forward, { position: { left: 100, top: 100 }, size: { width: 300, height: 200 } });
  assert.deepEqual(workbenchCreationPlacement({ x: 250, y: 130 }, { x: 100, y: 30 }, camera, true), forward);
});
test('click keeps existing rectangle size; Text drag cancels rather than creating accidentally', () => {
  const camera = { scale: 1, offset: { x: 0, y: 0 } };
  assert.deepEqual(workbenchCreationPlacement({ x: 100, y: 100 }, { x: 102, y: 102 }, camera, true).size, { width: 288, height: 288 });
  assert.equal(workbenchCreationPlacement({ x: 100, y: 100 }, { x: 120, y: 100 }, camera), null);
});
test('shape stays inside Workbench bounds and changed cameras invalidate gestures', () => {
  const camera = { scale: .25, offset: { x: 0, y: 0 } };
  assert.deepEqual(workbenchCreationPlacement({ x: -10, y: -20 }, { x: 2000, y: 2000 }, camera, true),
    { position: { left: 8, top: 8 }, size: { width: 3984, height: 3984 } });
  assert.equal(sameCreationCamera(camera, { ...camera, offset: { x: 1, y: 0 } }), false);
});
