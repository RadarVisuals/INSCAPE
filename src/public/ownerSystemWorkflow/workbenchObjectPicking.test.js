import test from 'node:test';
import assert from 'node:assert/strict';
import { compareWorkbenchPaint, nextWorkbenchObject, pointInWorkbenchFrame } from './workbenchObjectPicking.js';

test('overlap cycling reaches every object without changing the stack, including the top grid', () => {
  const hits = ['grid', 'image', 'rectangle', 'display'].map(id => ({ id }));
  let selected = [];
  const order = Array.from({ length: 5 }, () => { const id = nextWorkbenchObject(hits, selected); selected = [id]; return id; });
  assert.deepEqual(order, ['image', 'rectangle', 'display', 'grid', 'image']);
  assert.deepEqual(hits.map(item => item.id), ['grid', 'image', 'rectangle', 'display']);
  assert.equal(nextWorkbenchObject([], []), null);
  assert.equal(nextWorkbenchObject([{ id: 'only' }], []), 'only');
});
test('hit testing includes covered frames at fractional zoom and excludes zero-size frames', () => {
  const frame = { left: 70.5, top: 120.25, width: 25, height: 25 };
  assert.ok(pointInWorkbenchFrame({ x: 90, y: 140 }, frame));
  assert.equal(pointInWorkbenchFrame({ x: 96, y: 140 }, frame), false);
  assert.equal(pointInWorkbenchFrame({ x: 70.5, y: 120.25 }, { ...frame, width: 0 }), false);
});
test('stacking contexts keep a high-z background child below a foreground module', () => {
  const background = {}, foreground = {}, grid = {}, image = {};
  assert.ok(compareWorkbenchPaint([{ node: background, z: 0 }, { node: grid, z: 32 }],
    [{ node: foreground, z: 4 }, { node: image, z: 1 }]) > 0);
  const earlier = { compareDocumentPosition: () => 4 }, later = { compareDocumentPosition: () => 2 };
  assert.ok(compareWorkbenchPaint([{ node: earlier, z: 0 }], [{ node: later, z: 0 }]) > 0);
});
