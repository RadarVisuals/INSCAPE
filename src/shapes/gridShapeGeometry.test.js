import test from 'node:test';
import assert from 'node:assert/strict';
import { gridShapeFrame, wholeGridCells } from './gridShapeGeometry.js';
import { resizeWorkbenchWindow } from '../public/ownerSystemWorkflow/ownerSystemWorkflowWindowGeometry.js';

test('growing completes the last cell, shrinking removes whole cells and exact dimensions stay exact', () => {
  assert.equal(wholeGridCells(4000, 24), 4008);
  assert.equal(wholeGridCells(288, 24), 288);
  assert.equal(wholeGridCells(287, 24), 288);
  assert.equal(wholeGridCells(264, 24), 264);
  assert.equal(wholeGridCells(1, 24), 24);
  assert.equal(wholeGridCells(300.00000000001, 12.5), 300);
});
test('every resize edge retains its opposite anchor and uses complete cells at the workbench boundary', () => {
  const original = { left: 103, top: 207, width: 288, height: 288 };
  const bounds = { left: 8, top: 8, right: 3992, bottom: 3992 };
  for (const edge of ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se']) {
    const candidate = resizeWorkbenchWindow(original, edge, { x: 47, y: 61 }, { width: 24, height: 24 }, bounds);
    const result = gridShapeFrame(candidate, 24, { edge, bounds });
    assert.equal(result.width % 24, 0); assert.equal(result.height % 24, 0);
    assert.equal(edge.includes('w') ? result.left + result.width : result.left, edge.includes('w') ? 391 : 103);
    assert.equal(edge.includes('n') ? result.top + result.height : result.top, edge.includes('n') ? 495 : 207);
  }
  const result = gridShapeFrame({ ...original, width: 5000, height: 5000 }, 24, { bounds });
  assert.equal(result.width % 24, 0); assert.equal(result.height % 24, 0);
  assert.ok(result.left + result.width <= bounds.right); assert.ok(result.top + result.height <= bounds.bottom);
});
