import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../domain/latticeProductionDraft.js';
import { projectLatticeProductionViewport } from '../rendering/latticeProductionProjection.js';
import {
  LATTICE_PRODUCTION_RESIZE_CORNERS,
  createLatticeProductionGroupResizeCandidate,
  createLatticeProductionGroupResizeGesture,
  createLatticeProductionResizeCandidate,
  createLatticeProductionResizeGesture,
  finishLatticeProductionResizeGesture,
  latticeProductionPlacementBoundaries,
  latticeProductionGroupBounds,
  latticeProductionTopBoundaryRemoveDock,
  nudgeLatticeProductionResizeGeometry,
  resizeLatticeProductionGroupGeometries,
  finishLatticeProductionGroupResizeGesture,
  updateLatticeProductionGroupResizeGesture,
  updateLatticeProductionResizeGesture,
} from './latticeProductionResize.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const placement = (overrides = {}) => ({
  id: 'placement-a', stableAssetId: ASSET, column: 10, row: 5, columnSpan: 8, rowSpan: 6,
  layer: 0, navigationOrder: 0, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false }, ...overrides,
});
const field = projectLatticeProductionViewport({ geometry: { columns: 32, rows: 18 } }, { width: 1280, height: 720 });
const cornerPoint = {
  nw: { x: 400, y: 200 }, ne: { x: 720, y: 200 },
  se: { x: 720, y: 440 }, sw: { x: 400, y: 440 },
};

test('all four grid-native corners preserve the opposite anchor', () => {
  const expectedAnchors = { nw: [18, 11], ne: [10, 11], se: [10, 5], sw: [18, 5] };
  for (const corner of LATTICE_PRODUCTION_RESIZE_CORNERS) {
    const gesture = createLatticeProductionResizeGesture(placement(), corner, field, cornerPoint[corner]);
    const next = updateLatticeProductionResizeGesture(gesture, {
      x: cornerPoint[corner].x + (corner.includes('w') ? -80 : 80),
      y: cornerPoint[corner].y + (corner.includes('n') ? -40 : 40),
    }, field).previewGeometry;
    const anchor = [corner.includes('w') ? next.column + next.columnSpan : next.column,
      corner.includes('n') ? next.row + next.rowSpan : next.row];
    assert.deepEqual(anchor, expectedAnchors[corner]);
  }
});

test('resize uses a dead zone, nearest-cell snapping, one-cell minimum, complete bounds, and exact cancellation', () => {
  const start = createLatticeProductionResizeGesture(placement(), 'nw', field, cornerPoint.nw);
  const click = updateLatticeProductionResizeGesture(start, { x: 406, y: 207 }, field);
  assert.equal(click.activated, false);
  assert.equal(finishLatticeProductionResizeGesture(click).committed, false);
  const snapped = updateLatticeProductionResizeGesture(start, { x: 339, y: 139 }, field);
  assert.deepEqual(snapped.previewGeometry, { column: 8, row: 3, columnSpan: 10, rowSpan: 8 });
  const minimum = updateLatticeProductionResizeGesture(start, { x: 10000, y: 10000 }, field);
  assert.deepEqual(minimum.previewGeometry, { column: 17, row: 10, columnSpan: 1, rowSpan: 1 });
  const maximum = updateLatticeProductionResizeGesture(start, { x: -10000, y: -10000 }, field);
  assert.deepEqual(maximum.previewGeometry, { column: 0, row: 0, columnSpan: 18, rowSpan: 11 });
  assert.deepEqual(finishLatticeProductionResizeGesture(snapped, { cancelled: true }), {
    committed: false, geometry: { column: 10, row: 5, columnSpan: 8, rowSpan: 6 },
  });
});

test('keyboard resizing moves focused edges one cell and bounded input is a no-op', () => {
  assert.deepEqual(nudgeLatticeProductionResizeGeometry(placement(), 'se', { column: 1, row: -1 }), {
    column: 10, row: 5, columnSpan: 9, rowSpan: 5,
  });
  assert.equal(nudgeLatticeProductionResizeGeometry(placement({ column: 0, columnSpan: 1 }), 'nw', {
    column: -1, row: 0,
  }), null);
});

test('boundary state covers top, bottom, left, and right one-cell placements exactly', () => {
  const cases = [
    [placement({ column: 15, row: 0, columnSpan: 1, rowSpan: 1 }), { top: true, right: false, bottom: false, left: false }],
    [placement({ column: 15, row: 17, columnSpan: 1, rowSpan: 1 }), { top: false, right: false, bottom: true, left: false }],
    [placement({ column: 0, row: 8, columnSpan: 1, rowSpan: 1 }), { top: false, right: false, bottom: false, left: true }],
    [placement({ column: 31, row: 8, columnSpan: 1, rowSpan: 1 }), { top: false, right: true, bottom: false, left: false }],
    [placement({ column: 14, row: 8, columnSpan: 1, rowSpan: 1 }), { top: false, right: false, bottom: false, left: false }],
  ];
  for (const [candidate, expected] of cases) {
    assert.deepEqual(latticeProductionPlacementBoundaries(candidate), expected);
  }
});

test('top-boundary REMOVE docking clears corner handles for one-cell and full-width placements', () => {
  assert.deepEqual(latticeProductionTopBoundaryRemoveDock(
    placement({ column: 15, row: 0, columnSpan: 1, rowSpan: 1 }), 40,
  ), { side: 'right', maximumWidth: 631 });
  assert.deepEqual(latticeProductionTopBoundaryRemoveDock(
    placement({ column: 31, row: 0, columnSpan: 1, rowSpan: 1 }), 40,
  ), { side: 'left', maximumWidth: 1231 });
  assert.deepEqual(latticeProductionTopBoundaryRemoveDock(
    placement({ column: 0, row: 0, columnSpan: 32, rowSpan: 1 }), 40,
  ), { side: 'inside', maximumWidth: 1280 });
  assert.deepEqual(latticeProductionTopBoundaryRemoveDock(
    placement({ column: 15, row: 1, columnSpan: 1, rowSpan: 1 }), 40,
  ), { side: null, maximumWidth: null });
});

test('completed resize changes geometry only and rejects stale snapshots, invalid anchors, locks, and no-ops', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const expected = placement();
  draft.tables[4].placements = [expected];
  const before = structuredClone(draft);
  const request = { corner: 'se', destination: { column: 10, row: 5, columnSpan: 10, rowSpan: 8 },
    expectedPlacement: structuredClone(expected), placementId: expected.id, tableId: 'table-05' };
  const candidate = createLatticeProductionResizeCandidate(draft, request);
  assert.deepEqual(candidate.tables[4].placements[0], { ...expected, columnSpan: 10, rowSpan: 8 });
  assert.deepEqual(draft, before);
  assert.equal(createLatticeProductionResizeCandidate(draft, {
    ...request, destination: { column: 10, row: 5, columnSpan: 8, rowSpan: 6 },
  }), null);
  assert.throws(() => createLatticeProductionResizeCandidate(draft, {
    ...request, expectedPlacement: { ...expected, column: 9 },
  }), { code: 'LATTICE_RESIZE_PLACEMENT_STALE' });
  assert.throws(() => createLatticeProductionResizeCandidate(draft, {
    ...request, destination: { column: 9, row: 5, columnSpan: 10, rowSpan: 8 },
  }), { code: 'LATTICE_RESIZE_ANCHOR_CHANGED' });
  const locked = structuredClone(draft); locked.tables[4].placements[0].locked = true;
  assert.throws(() => createLatticeProductionResizeCandidate(locked, {
    ...request, expectedPlacement: structuredClone(locked.tables[4].placements[0]),
  }), { code: 'LATTICE_RESIZE_PLACEMENT_LOCKED' });
});

test('group resize scales placement geometry and spacing through one shared grid frame', () => {
  const placements = [
    placement({ id: 'a', column: 2, row: 2, columnSpan: 4, rowSpan: 4 }),
    placement({ id: 'b', column: 8, row: 6, columnSpan: 2, rowSpan: 2, layer: 1, navigationOrder: 1 }),
  ];
  assert.deepEqual(latticeProductionGroupBounds(placements), {
    column: 2, row: 2, columnSpan: 8, rowSpan: 6,
  });
  assert.deepEqual(resizeLatticeProductionGroupGeometries(placements, {
    column: 0, row: 0, columnSpan: 16, rowSpan: 12,
  }), [
    { placementId: 'a', destination: { column: 0, row: 0, columnSpan: 8, rowSpan: 8 } },
    { placementId: 'b', destination: { column: 12, row: 8, columnSpan: 4, rowSpan: 4 } },
  ]);
  const gesture = createLatticeProductionGroupResizeGesture(placements, 'se', field, { x: 400, y: 320 });
  const updated = updateLatticeProductionGroupResizeGesture(gesture, { x: 480, y: 360 }, field);
  assert.equal(updated.activated, true);
  assert.deepEqual(updated.frameGesture.previewGeometry, { column: 2, row: 2, columnSpan: 10, rowSpan: 7 });
  assert.equal(finishLatticeProductionGroupResizeGesture(updated).committed, true);
  assert.deepEqual(finishLatticeProductionGroupResizeGesture(updated, { cancelled: true }).destinations, [
    { placementId: 'a', destination: { column: 2, row: 2, columnSpan: 4, rowSpan: 4 } },
    { placementId: 'b', destination: { column: 8, row: 6, columnSpan: 2, rowSpan: 2 } },
  ]);
});

test('group resize candidate is atomic, snapshot guarded, and rejects a locked member', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const expected = [
    placement({ id: 'a', column: 2, row: 2, columnSpan: 4, rowSpan: 4 }),
    placement({ id: 'b', column: 8, row: 6, columnSpan: 2, rowSpan: 2, layer: 1, navigationOrder: 1 }),
  ];
  draft.tables[4].placements = expected;
  const destinations = resizeLatticeProductionGroupGeometries(expected, {
    column: 0, row: 0, columnSpan: 10, rowSpan: 8,
  });
  const request = {
    corner: 'nw', destinations, expectedPlacements: structuredClone(expected),
    placementIds: ['a', 'b'], tableId: 'table-05',
  };
  const before = structuredClone(draft);
  const candidate = createLatticeProductionGroupResizeCandidate(draft, request);
  assert.deepEqual(candidate.tables[4].placements.map(({ column, row, columnSpan, rowSpan }) => ({
    column, row, columnSpan, rowSpan,
  })), destinations.map(({ destination }) => destination));
  assert.deepEqual(draft, before);
  const locked = structuredClone(draft);
  locked.tables[4].placements[1].locked = true;
  assert.throws(() => createLatticeProductionGroupResizeCandidate(locked, {
    ...request, expectedPlacements: structuredClone(locked.tables[4].placements),
  }), { code: 'LATTICE_RESIZE_PLACEMENT_LOCKED' });
  assert.deepEqual(locked.tables[4].placements[0], before.tables[4].placements[0]);
});
