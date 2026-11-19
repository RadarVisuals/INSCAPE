import test from 'node:test';
import assert from 'node:assert/strict';
import { editorCellMoveIds, editorCellPreviewTransforms, editorCellClip, transformedCellWindow, projectReceptionCellMembers } from './editorCellGeometry.js';

const cells = [{ id: 'shape:cell', members: ['image:child', 'shape:child'] }];
const presentation = { shapes: [
  { id: 'shape:cell', window: { left: 100, top: 100, width: 400, height: 200 } },
  { id: 'shape:child', window: { left: 200, top: 120, width: 40, height: 50 } },
], imageModules: [{ id: 'image:child', position: { left: 120, top: 130 } }] };
const content = { imageModules: [{ id: 'image:child', width: 100, height: 80 }] };

test('outer cell gestures include content; editing a child keeps it independent', () => {
  assert.deepEqual(editorCellMoveIds(cells, ['shape:cell'], null), ['shape:cell', 'image:child', 'shape:child']);
  assert.deepEqual(editorCellMoveIds(cells, ['image:child'], null), ['shape:cell', 'image:child', 'shape:child']);
  assert.deepEqual(editorCellMoveIds(cells, ['image:child'], 'shape:cell'), ['image:child']);
  assert.deepEqual(editorCellMoveIds(cells, ['shape:cell', 'image:child'], 'shape:cell'), ['shape:cell', 'image:child', 'shape:child']);
});

test('cell resize previews transform child geometry without changing authored windows', () => {
  const original = structuredClone(presentation);
  const transforms = { 'shape:cell': { scale: 1, x: 0, y: 0, frame: { left: 50, top: 80, width: 200, height: 400 } } };
  const result = editorCellPreviewTransforms(cells, transforms, presentation, content);
  assert.deepEqual(result['image:child'].frame, { left: 60, top: 140, width: 50, height: 160 });
  assert.deepEqual(result['shape:child'].frame, { left: 100, top: 120, width: 20, height: 100 });
  assert.deepEqual(presentation, original);
  assert.equal(Object.hasOwn(transforms, 'image:child'), false);
});

test('explicit member previews are not transformed a second time', () => {
  const image = { scale: 1, x: 30, y: 20 };
  const transforms = { 'shape:cell': { scale: 1, x: 30, y: 20 }, 'image:child': image };
  const result = editorCellPreviewTransforms(cells, transforms, presentation, content);
  assert.equal(result['image:child'], image);
  assert.deepEqual(result['shape:child'].frame, { left: 230, top: 140, width: 40, height: 50 });
});

test('raising either cell edge leaves free text stationary while moving the whole cell carries it', () => {
  const cell = { id: 'shape:cell', members: ['text:body'] };
  const owner = { left: 100, top: 50, width: 600, height: 800 };
  const text = { left: 140, top: 90, width: 520, height: 500 };
  const layout = { shapes: [{ id: cell.id, window: owner }], texts: [{ id: 'text:body', window: text }] };
  for (const resized of [{ ...owner, height: 500 }, { ...owner, height: 1000 }, { ...owner, top: 200, height: 650 }]) {
    const transforms = { [cell.id]: { scale: 1, x: 0, y: 0, frame: resized } };
    const live = editorCellPreviewTransforms([cell], transforms, layout, {});
    const frame = live['text:body'].frame;
    assert.deepEqual(frame, text, 'the cell edge crops the unchanged text frame');
    assert.deepEqual(live['text:body'].frame, projectReceptionCellMembers(owner, resized, { 'text:body': text }, cell)['text:body']);
    const explicit = { scale: 1, x: 0, y: 0, frame: { ...text, height: 100 } };
    assert.equal(editorCellPreviewTransforms([cell], { ...transforms, 'text:body': explicit }, layout, {})['text:body'], explicit);
    const single = projectReceptionCellMembers(owner, resized, { 'text:body': text }, { ...cell, singleLine: true })['text:body'];
    assert.deepEqual(single, text);
    const fitted = projectReceptionCellMembers(owner, resized, { 'text:body': text }, { ...cell, fitText: ['text:body'] })['text:body'];
    assert.equal(fitted.height, text.height);
    const responsive = projectReceptionCellMembers(owner, resized, { 'text:body': text }, cell, { responsive: true })['text:body'];
    assert.equal(responsive.height, text.height * resized.height / owner.height, 'viewport projection still scales authored geometry');
  }
  const moved = projectReceptionCellMembers(owner, { ...owner, top: 150 }, { 'text:body': text }, cell)['text:body'];
  assert.deepEqual(moved, { ...text, top: 190 }, 'moving alone does not resize a deliberately smaller text box');
  assert.deepEqual(layout.texts[0].window, text);
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

test('an individually aligned Text frame keeps horizontal and vertical edits independent', () => {
  const before = { left: 100, top: 50, width: 600, height: 800 };
  const text = { left: 200, top: 250, width: 400, height: 400 };
  const anchor = { members: ['text:body'], alignX: 'center', alignY: 'center', paddingX: 24, paddingY: 24 };
  const cell = { id: 'shape:cell', members: ['text:body'], memberAnchors: [anchor] };
  const horizontal = projectReceptionCellMembers(before, { ...before, left: 180, width: 520 }, { 'text:body': text }, cell)['text:body'];
  assert.equal(horizontal.top, text.top); assert.equal(horizontal.height, text.height);
  assert.ok(horizontal.left > text.left); assert.ok(horizontal.width < text.width);
  const vertical = projectReceptionCellMembers(before, { ...before, top: 200, height: 650 }, { 'text:body': text }, cell)['text:body'];
  assert.equal(vertical.left, text.left); assert.equal(vertical.width, text.width);
  assert.equal(vertical.height, text.height); assert.ok(vertical.top > text.top);
  const moved = projectReceptionCellMembers(before, { ...before, top: -150 }, { 'text:body': text }, cell, { moveContents: true })['text:body'];
  assert.deepEqual(moved, { ...text, top: 50 }, 'moving upward cannot add sideways movement or scale');
  const responsive = projectReceptionCellMembers(before, { ...before, width: 300, height: 400 }, { 'text:body': text }, cell, { responsive: true })['text:body'];
  assert.equal(responsive.width, 200); assert.equal(responsive.height, 200, 'read-only viewport projection remains proportional');
});
