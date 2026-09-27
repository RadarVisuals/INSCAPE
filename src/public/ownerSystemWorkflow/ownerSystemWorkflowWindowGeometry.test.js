import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampOwnerSystemWorkflowWindowHeight,
  clampOwnerSystemWorkflowWindowPosition,
  presentationBoardAdjacentWindowGeometry,
  resizeWorkbenchWindow,
} from './ownerSystemWorkflowWindowGeometry.js';

test('each resize edge preserves its opposite edge and enforces minimum dimensions', () => {
  const frame = { left: 120, top: 180, width: 360, height: 420 };
  const minimum = { width: 180, height: 100 }, bounds = { left: 8, top: 8, right: 7992, bottom: 7992 };
  for (const edge of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
    const next = resizeWorkbenchWindow(frame, edge, { x: 80, y: 40 }, minimum, bounds);
    assert.equal(edge.includes('w') ? next.left + next.width : next.left, edge.includes('w') ? 480 : 120);
    assert.equal(edge.includes('n') ? next.top + next.height : next.top, edge.includes('n') ? 600 : 180);
    assert.equal(next.width, frame.width + (edge.includes('w') ? -80 : edge.includes('e') ? 80 : 0));
    assert.equal(next.height, frame.height + (edge.includes('n') ? -40 : edge.includes('s') ? 40 : 0));
    const smallest = resizeWorkbenchWindow(frame, edge, { x: edge.includes('w') ? 9999 : -9999, y: edge.includes('n') ? 9999 : -9999 }, minimum, bounds);
    assert.ok(smallest.width >= 180 && smallest.height >= 100);
  }
  assert.deepEqual(resizeWorkbenchWindow(frame, 'nw', { x: -9999, y: -9999 }, minimum, bounds), { left: 8, top: 8, width: 472, height: 592 });
});

test('detached Workbench windows reclamp from wide to narrow using their measured size', () => {
  assert.deepEqual(clampOwnerSystemWorkflowWindowPosition(
    { x: 1122, y: 72 }, { width: 286, height: 187 }, { width: 390, height: 668 },
  ), { x: 96, y: 72 });
});

test('content growth reclamps only the axis that no longer fits', () => {
  assert.deepEqual(clampOwnerSystemWorkflowWindowPosition(
    { x: 700, y: 300 }, { width: 286, height: 360 }, { width: 1200, height: 700 },
  ), { x: 700, y: 300 });
  assert.deepEqual(clampOwnerSystemWorkflowWindowPosition(
    { x: 700, y: 300 }, { width: 286, height: 520 }, { width: 1200, height: 700 },
  ), { x: 700, y: 172 });
});

test('valid detached positions survive viewport growth and tiny viewports retain a reachable origin', () => {
  assert.deepEqual(clampOwnerSystemWorkflowWindowPosition(
    { x: 96, y: 72 }, { width: 286, height: 187 }, { width: 1440, height: 858 },
  ), { x: 96, y: 72 });
  assert.deepEqual(clampOwnerSystemWorkflowWindowPosition(
    { x: 100, y: 100 }, { width: 286, height: 360 }, { width: 240, height: 300 },
  ), { x: 8, y: 8 });
});

test('detached Metadata opens beside the Display Module with one clear gutter and matching outer height', () => {
  assert.deepEqual(presentationBoardAdjacentWindowGeometry(
    { height: 420, right: 622, top: 44 },
    { height: 900, width: 1400 },
    { chromeGutter: 6 },
  ), { height: 426, position: { x: 634, y: 44 } });
});

test('adjacent Metadata placement remains reachable when the preferred right side does not fit', () => {
  assert.deepEqual(presentationBoardAdjacentWindowGeometry(
    { height: 420, right: 622, top: 44 },
    { height: 500, width: 800 },
    { chromeGutter: 6 },
  ), { height: 426, position: { x: 472, y: 44 } });
});

test('automatic Metadata sizing preserves a short Display Module match while manual resizing keeps its usable minimum', () => {
  assert.equal(clampOwnerSystemWorkflowWindowHeight(160, 120, 500), 160);
  assert.equal(clampOwnerSystemWorkflowWindowHeight(160, 120, 500, { minimum: 180 }), 180);
});
