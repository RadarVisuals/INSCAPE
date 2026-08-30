import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLatticePixelBoundaryPositions,
  createLatticePixelGuideBounds,
  projectLatticePixelBoundary,
  projectLatticeRasterBleedRectangle,
  projectLatticePixelRectangle,
} from './latticePixelGeometry.js';

test('guide bounds isolate the canonical placeable rectangle from surrounding viewport gutters', () => {
  assert.deepEqual(createLatticePixelGuideBounds({
    left: 56,
    top: 32,
    referenceWidth: 1184,
    referenceHeight: 666,
  }), { x: 56, y: 32, width: 1184, height: 666 });
  assert.equal(createLatticePixelGuideBounds({ left: 0, top: 0 }), null,
    'unbounded fields such as the Workbench grid retain their full-viewport guides');
});

test('inset guide bounds remove perimeter guides while retaining the interior field', () => {
  assert.deepEqual(createLatticePixelGuideBounds({
    left: 56,
    top: 32,
    referenceWidth: 1184,
    referenceHeight: 666,
  }, 18.5), { x: 74.5, y: 50.5, width: 1147, height: 629 });
});

test('fractional lattice geometry shares exact pixel boundaries between guides and placements', () => {
  const field = { left: 5.625, top: 0, cellSize: 39.7777777778 };
  const positions = createLatticePixelBoundaryPositions(field, 'column', 1, 1365, 1);
  assert.deepEqual(positions.slice(0, 4), [6.5, 45.5, 85.5, 125.5]);
  assert.equal(positions.every((position) => position % 1 === 0.5), true);
  assert.deepEqual(projectLatticePixelRectangle({ column: 1, row: 2, columnSpan: 3, rowSpan: 4 }, field), {
    left: 45, top: 80, width: 120, height: 159,
  });
});

test('fractional guide intervals, adjacent placements, and resize corners use one pixel boundary authority', () => {
  const field = { left: 7.375, top: 11.625, cellSize: 37.3333333333 };
  const interval = 5 / 9;
  const columns = createLatticePixelBoundaryPositions(field, 'column', interval, 1280, 1);
  const rows = createLatticePixelBoundaryPositions(field, 'row', interval, 720, 1);
  const first = projectLatticePixelRectangle({ column: 10 / 9, row: 5 / 9, columnSpan: 20 / 9, rowSpan: 15 / 9 }, field);
  const second = projectLatticePixelRectangle({ column: 30 / 9, row: 5 / 9, columnSpan: 10 / 9, rowSpan: 15 / 9 }, field);
  assert.equal(first.left + first.width, second.left, 'adjacent placement edges share one exact pixel');
  assert.equal(columns.includes(projectLatticePixelBoundary(field, 'column', 10 / 9) + 0.5), true);
  assert.equal(columns.includes(projectLatticePixelBoundary(field, 'column', 30 / 9) + 0.5), true);
  assert.equal(rows.includes(projectLatticePixelBoundary(field, 'row', 5 / 9) + 0.5), true);
  assert.equal(rows.includes(projectLatticePixelBoundary(field, 'row', 20 / 9) + 0.5), true);
});

test('full-bleed media crosses raster edges while intentional contain letterboxing remains intact', () => {
  const opening = { left: 244, top: 334, width: 61, height: 37 };
  assert.deepEqual(projectLatticeRasterBleedRectangle({ ...opening }, opening), {
    left: 243, top: 333, width: 63, height: 39,
  });
  assert.deepEqual(projectLatticeRasterBleedRectangle({
    left: 244, top: 340, width: 61, height: 25,
  }, opening), {
    left: 243, top: 340, width: 63, height: 25,
  });
  assert.deepEqual(projectLatticeRasterBleedRectangle({
    left: 243.99999999999, top: 333.99999999999, width: 61.00000000002, height: 37.00000000002,
  }, opening), {
    left: 242.99999999999, top: 332.99999999999, width: 63.00000000002, height: 39.00000000002,
  });
  assert.deepEqual(projectLatticeRasterBleedRectangle({
    left: 244.25, top: 334, width: 60.5, height: 37,
  }, opening), {
    left: 243.25, top: 333, width: 62.5, height: 39,
  }, 'sub-pixel contain-fit residue bleeds across both rounded vertical edges');
  assert.deepEqual(projectLatticeRasterBleedRectangle({
    left: 245, top: 334, width: 59, height: 37,
  }, opening), {
    left: 244, top: 333, width: 61, height: 39,
  }, 'a one-layout-pixel fitting remainder cannot leak backing at either vertical edge');
  assert.deepEqual(projectLatticeRasterBleedRectangle({
    left: 246, top: 334, width: 57, height: 37,
  }, opening), {
    left: 246, top: 333, width: 57, height: 39,
  }, 'letterboxing larger than one layout pixel remains intentional');
  assert.throws(() => projectLatticeRasterBleedRectangle(null, opening), /positive rectangles/);
});
