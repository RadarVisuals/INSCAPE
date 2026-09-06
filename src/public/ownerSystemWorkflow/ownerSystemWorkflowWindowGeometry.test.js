import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampOwnerSystemWorkflowWindowHeight,
  clampOwnerSystemWorkflowWindowPosition,
  presentationBoardAdjacentWindowGeometry,
} from './ownerSystemWorkflowWindowGeometry.js';

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
