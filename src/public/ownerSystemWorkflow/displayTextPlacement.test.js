import assert from 'node:assert/strict';
import test from 'node:test';
import { displayTextDestinationAt } from './displayTextPlacement.js';

const field = { left: -120, top: 50, cellSize: 12, rowSize: 12, columns: 32, rows: 18, snapStep: 1,
  viewportLeft: 0, viewportTop: 50, viewportWidth: 264, viewportHeight: 216 };

test('text click placement uses the projected Display origin and authored snap step', () => {
  assert.deepEqual(displayTextDestinationAt({ x: 24, y: 86 }, field), { column: 12, row: 3, columnSpan: 16, rowSpan: 6 });
  const enlarged = { ...field, left: 100, top: 90, cellSize: 30, rowSize: 30, viewportLeft: 100, viewportTop: 90, viewportWidth: 960, viewportHeight: 540 };
  assert.deepEqual(displayTextDestinationAt({ x: 460, y: 180 }, enlarged), { column: 12, row: 3, columnSpan: 16, rowSpan: 6 });
  assert.equal(displayTextDestinationAt({ x: 26, y: 86 }, { ...field, snapStep: 1 / 9 }).column, 12 + 2 / 9);
});

test('initial text fits the Display and clipped or off-canvas clicks do nothing', () => {
  assert.deepEqual(displayTextDestinationAt({ x: 260, y: 263 }, field), { column: 16, row: 12, columnSpan: 16, rowSpan: 6 });
  for (const point of [{ x: -20, y: 90 }, { x: 265, y: 90 }, { x: 20, y: 40 }, { x: 20, y: 267 }])
    assert.equal(displayTextDestinationAt(point, field), null);
  assert.equal(displayTextDestinationAt({ x: 0, y: 0 }, null), null);
  const tiny = { ...field, left: 0, top: 0, columns: 4, rows: 2, viewportLeft: 0, viewportTop: 0, viewportWidth: 48, viewportHeight: 24 };
  assert.deepEqual(displayTextDestinationAt({ x: 20, y: 10 }, tiny), { column: 0, row: 0, columnSpan: 4, rowSpan: 2 });
});
