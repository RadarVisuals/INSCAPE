import assert from 'node:assert/strict';
import test from 'node:test';
import { projectDisplayPlacementRectangle, projectDisplayStageViewport } from './displayPaintGeometry.js';
import { workbenchPaintStyle } from '../../public/ownerSystemWorkflow/workbenchPaintGeometry.js';

test('physical Stage and adjoining artwork share integer endpoints through camera pan and zoom', () => {
  const frame = Object.freeze({ left: 340.6, top: 100.7, width: 601.3, height: 601.3 * 9 / 16 });
  const a = Object.freeze({ column: 0, row: 0, columnSpan: 16, rowSpan: 9 });
  const b = Object.freeze({ column: 16, row: 9, columnSpan: 16, rowSpan: 9 });
  for (const density of [1, 1.25, 1.5, 2]) for (const scale of [.25, .413, .67, .997, 1, 1.371, 2]) {
    const surface = workbenchPaintStyle(frame, { scale, x: 3.17, y: -1.13 }, { x: -31.7, y: 12.37 }, density);
    const field = projectDisplayStageViewport({ columns: 32, rows: 18 }, surface);
    const first = projectDisplayPlacementRectangle(a, field), second = projectDisplayPlacementRectangle(b, field);
    assert.deepEqual([first.left, first.top], [0, 0]);
    assert.equal(first.left + first.width, second.left);
    assert.equal(first.top + first.height, second.top);
    assert.equal(second.left + second.width, surface.width);
    assert.equal(second.top + second.height, surface.height);
    for (const value of [...Object.values(first), ...Object.values(second)]) assert.ok(Number.isInteger(value));
    const matrix = surface.transform.slice(7, -1).split(',').map(Number);
    assert.ok(Math.abs(matrix[0] * density - 1) < 1e-9);
    assert.ok(Math.abs(matrix[4] * density - Math.round((frame.left * scale + 3.17 - 31.7) * density)) < 1e-9);
  }
});
