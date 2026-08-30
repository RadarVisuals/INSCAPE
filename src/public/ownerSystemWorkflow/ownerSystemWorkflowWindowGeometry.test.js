import assert from 'node:assert/strict';
import test from 'node:test';
import { clampOwnerSystemWorkflowWindowPosition } from './ownerSystemWorkflowWindowGeometry.js';

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
