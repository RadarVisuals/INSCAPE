import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../domain/latticeProductionDraft.js';
import { projectLatticeProductionViewport } from '../rendering/latticeProductionProjection.js';
import {
  createLatticeProductionMovementCandidate,
  createLatticeProductionMovementGesture,
  finishLatticeProductionMovementGesture,
  nudgeLatticeProductionPlacementGeometry,
  updateLatticeProductionMovementGesture,
} from './latticeProductionMovement.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const placement = (overrides = {}) => ({
  id: 'placement-1', stableAssetId: ASSET,
  column: 10, row: 5, columnSpan: 12, rowSpan: 7,
  layer: 0, navigationOrder: 0, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: 'PUBLIC', locked: false, ...overrides,
});

const model = { geometry: { columns: 32, rows: 18 } };

test('movement uses the accepted resized and letterboxed Phase 3 projection field', () => {
  const field = projectLatticeProductionViewport(model, { width: 1000, height: 1000 });
  assert.deepEqual(field, { cellSize: 31.25, width: 1000, height: 562.5, left: 0, top: 218.75 });
  const start = createLatticeProductionMovementGesture(placement(), field, {
    x: field.left + (13.25 * field.cellSize),
    y: field.top + (7.75 * field.cellSize),
  });
  const moved = updateLatticeProductionMovementGesture(start, {
    x: field.left + (18.8 * field.cellSize),
    y: field.top + (10.2 * field.cellSize),
  }, field);
  assert.deepEqual(moved.grabOffset, { column: 3.25, row: 2.75 });
  assert.deepEqual(moved.previewGeometry, { column: 16, row: 7, columnSpan: 12, rowSpan: 7 });
});

test('different grab points preserve their fractional offset without pointer jumps', () => {
  const field = projectLatticeProductionViewport(model, { width: 1280, height: 720 });
  for (const offset of [{ column: 0.25, row: 0.5 }, { column: 6, row: 3.5 }, { column: 11.75, row: 6.75 }]) {
    const start = createLatticeProductionMovementGesture(placement(), field, {
      x: field.left + ((10 + offset.column) * field.cellSize),
      y: field.top + ((5 + offset.row) * field.cellSize),
    });
    const moved = updateLatticeProductionMovementGesture(start, {
      x: field.left + ((12 + offset.column) * field.cellSize),
      y: field.top + ((8 + offset.row) * field.cellSize),
    }, field);
    assert.deepEqual(moved.previewGeometry, { column: 12, row: 8, columnSpan: 12, rowSpan: 7 });
  }
});

test('dead-zone, snapping, same-cell completion, cancellation, and bounds are deterministic', () => {
  const field = projectLatticeProductionViewport(model, { width: 1280, height: 720 });
  const origin = { x: 500, y: 300 };
  const start = createLatticeProductionMovementGesture(placement(), field, origin);
  const click = updateLatticeProductionMovementGesture(start, { x: 506, y: 307 }, field);
  assert.equal(click.activated, false);
  assert.equal(finishLatticeProductionMovementGesture(click).committed, false);
  const sameCell = updateLatticeProductionMovementGesture(start, { x: 510, y: 300 }, field);
  assert.equal(sameCell.activated, true);
  assert.equal(finishLatticeProductionMovementGesture(sameCell).committed, false);
  const edge = updateLatticeProductionMovementGesture(start, { x: 100000, y: -100000 }, field);
  assert.deepEqual(edge.previewGeometry, { column: 20, row: 0, columnSpan: 12, rowSpan: 7 });
  assert.deepEqual(finishLatticeProductionMovementGesture(edge, { cancelled: true }), {
    committed: false, geometry: { column: 10, row: 5, columnSpan: 12, rowSpan: 7 },
  });
});

test('keyboard nudges use one bounded integer cell and edge no-ops return null', () => {
  assert.deepEqual(nudgeLatticeProductionPlacementGeometry(placement(), { column: -1, row: 1 }), {
    column: 9, row: 6, columnSpan: 12, rowSpan: 7,
  });
  assert.equal(nudgeLatticeProductionPlacementGeometry(placement({ column: 0 }), { column: -1, row: 0 }), null);
  assert.equal(nudgeLatticeProductionPlacementGeometry(placement({ row: 11 }), { column: 0, row: 1 }), null);
});

test('complete candidates change only integer position and reject stale, locked, private, resize, and no-op input', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [placement()];
  const before = structuredClone(draft);
  const request = {
    tableId: 'table-05', placementId: 'placement-1',
    expectedStartGeometry: { column: 10, row: 5, columnSpan: 12, rowSpan: 7 },
    destination: { column: 4, row: 3, columnSpan: 12, rowSpan: 7 },
  };
  const candidate = createLatticeProductionMovementCandidate(draft, request);
  assert.deepEqual(candidate.tables[4].placements[0], { ...placement(), column: 4, row: 3 });
  assert.deepEqual(draft, before);
  assert.equal(createLatticeProductionMovementCandidate(draft, {
    ...request, destination: request.expectedStartGeometry,
  }), null);
  assert.throws(() => createLatticeProductionMovementCandidate(draft, {
    ...request, expectedStartGeometry: { ...request.expectedStartGeometry, column: 9 },
  }), { code: 'LATTICE_MOVEMENT_START_STALE' });
  assert.throws(() => createLatticeProductionMovementCandidate(draft, {
    ...request, destination: { ...request.destination, columnSpan: 11 },
  }), { code: 'LATTICE_MOVEMENT_SPAN_CHANGED' });
  const locked = structuredClone(draft); locked.tables[4].placements[0].locked = true;
  assert.throws(() => createLatticeProductionMovementCandidate(locked, request), { code: 'LATTICE_MOVEMENT_PLACEMENT_LOCKED' });
  const privatePlacement = structuredClone(draft); privatePlacement.tables[4].placements[0].visibility = 'PRIVATE';
  assert.throws(() => createLatticeProductionMovementCandidate(privatePlacement, request), { code: 'LATTICE_MOVEMENT_PLACEMENT_PRIVATE' });
  const privateTable = structuredClone(draft); privateTable.tables[4].visibility = 'PRIVATE';
  assert.throws(() => createLatticeProductionMovementCandidate(privateTable, request), { code: 'LATTICE_MOVEMENT_TABLE_PRIVATE' });
});
