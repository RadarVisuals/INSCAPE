import test from 'node:test';
import assert from 'node:assert/strict';
import { editorCellMoveIds, editorCellPreviewTransforms, editorCellClip, transformedCellWindow } from './editorCellGeometry.js';

const cells = [{ id: 'shape:cell', members: ['image:child', 'shape:child'] }];
const presentation = { shapes: [
  { id: 'shape:cell', window: { left: 100, top: 100, width: 400, height: 200 } },
  { id: 'shape:child', window: { left: 200, top: 120, width: 40, height: 50 } },
], imageModules: [{ id: 'image:child', window: { left: 120, top: 130, width: 100, height: 80 } }] };

test('outer cell gestures include content; editing a child keeps it independent', () => {
  assert.deepEqual(editorCellMoveIds(cells, ['shape:cell'], null), ['shape:cell', 'image:child', 'shape:child']);
  assert.deepEqual(editorCellMoveIds(cells, ['image:child'], null), ['shape:cell', 'image:child', 'shape:child']);
  assert.deepEqual(editorCellMoveIds(cells, ['image:child'], 'shape:cell'), ['image:child']);
  assert.deepEqual(editorCellMoveIds(cells, ['shape:cell', 'image:child'], 'shape:cell'), ['shape:cell', 'image:child', 'shape:child']);
});

test('cell resize previews transform child geometry without changing authored windows', () => {
  const original = structuredClone(presentation);
  const transforms = { 'shape:cell': { scale: 1, x: 0, y: 0, frame: { left: 50, top: 80, width: 200, height: 400 } } };
  const result = editorCellPreviewTransforms(cells, transforms, presentation);
  assert.deepEqual(result['image:child'].frame, { left: 60, top: 140, width: 50, height: 160 });
  assert.deepEqual(result['shape:child'].frame, { left: 100, top: 120, width: 20, height: 100 });
  assert.deepEqual(presentation, original);
  assert.equal(Object.hasOwn(transforms, 'image:child'), false);
});

test('explicit member previews are not transformed a second time', () => {
  const image = { scale: 1, x: 30, y: 20 };
  const transforms = { 'shape:cell': { scale: 1, x: 30, y: 20 }, 'image:child': image };
  const result = editorCellPreviewTransforms(cells, transforms, presentation);
  assert.equal(result['image:child'], image);
  assert.deepEqual(result['shape:child'].frame, { left: 230, top: 140, width: 40, height: 50 });
});

test('clipping is local to the member frame, including content crossing every edge', () => {
  assert.equal(editorCellClip({ left: 100, top: 100, width: 100, height: 100 }, { left: 50, top: 50, width: 200, height: 200 }), 'inset(25% 25% 25% 25%)');
  assert.equal(editorCellClip({ left: 100, top: 100, width: 100, height: 100 }, { left: 120, top: 120, width: 40, height: 40 }), 'inset(0% 0% 0% 0%)');
  assert.equal(editorCellClip({ left: 100, top: 100, width: 100, height: 100 }, { left: 250, top: 120, width: 40, height: 40 }), 'inset(0% 100% 0% 0%)');
  assert.deepEqual(transformedCellWindow({ left: 10, top: 20, width: 30, height: 40 }, { scale: 2, x: 5, y: -5 }), { left: 25, top: 35, width: 60, height: 80 });
});

test('rounded clipping keeps parent corners outside a smaller child instead of rounding the child', () => {
  const path = editorCellClip({ left: 100, top: 100, width: 200, height: 100 }, { left: 120, top: 120, width: 40, height: 40 }, 10, 2);
  assert.equal(path, "path('M -20 -40 H 340 Q 360 -40 360 -20 V 140 Q 360 160 340 160 H -20 Q -40 160 -40 140 V -20 Q -40 -40 -20 -40 Z')");
});

test('coupled cell movement and resize previews include sibling contents while inner edits stay independent', () => {
  const grouped = [...cells, { id: 'shape:second', members: ['text:second'] }];
  const groups = [{ members: ['shape:cell', 'shape:second'] }];
  const layout = { ...presentation, shapes: [...presentation.shapes, { id: 'shape:second', window: { left: 520, top: 100, width: 100, height: 200 } }],
    texts: [{ id: 'text:second', window: { left: 530, top: 110, width: 80, height: 50 } }] };
  assert.deepEqual(editorCellMoveIds(grouped, ['shape:cell'], null, groups), ['shape:cell', 'image:child', 'shape:child', 'shape:second', 'text:second']);
  assert.deepEqual(editorCellMoveIds(grouped, ['text:second'], 'shape:second', groups), ['text:second']);
  const preview = editorCellPreviewTransforms(grouped, { 'shape:cell': { scale: 2, x: -100, y: -100 } }, layout, groups);
  assert.deepEqual(preview['shape:second'].frame, { left: 940, top: 100, width: 200, height: 400 });
  assert.deepEqual(preview['text:second'].frame, { left: 960, top: 120, width: 160, height: 100 });
});
