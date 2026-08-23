import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLatticePixelBoundaryPositions,
  projectLatticePixelBoundary,
  projectLatticePixelRectangle,
} from './latticePixelGeometry.js';

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
