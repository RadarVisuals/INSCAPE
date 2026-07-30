import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../domain/latticeProductionDraft.js';
import {
  LATTICE_PRODUCTION_LAYER_OPERATIONS,
  createLatticeProductionLayerCandidate,
  latticeProductionPlacementToolbarDock,
  latticeProductionLayerTopologySnapshot,
} from './latticeProductionLayer.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const placement = (id, layer, overrides = {}) => ({
  id, stableAssetId: ASSET, column: 1, row: 2, columnSpan: 4, rowSpan: 3,
  layer, navigationOrder: layer === Number.MAX_SAFE_INTEGER ? 99 : layer,
  crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: 'PUBLIC', locked: false, ...overrides,
});

function candidateFor(draft, placementId, operation) {
  const table = draft.tables[4];
  return createLatticeProductionLayerCandidate(draft, {
    expectedPlacement: structuredClone(table.placements.find(({ id }) => id === placementId)),
    expectedPlacements: latticeProductionLayerTopologySnapshot(table),
    operation,
    placementId,
    tableId: table.id,
  });
}

test('FORWARD and BACKWARD swap sparse existing values without changing array or navigation order', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [placement('a', 0), placement('b', 7), placement('c', Number.MAX_SAFE_INTEGER)];
  const before = structuredClone(draft);
  const forward = candidateFor(draft, 'a', LATTICE_PRODUCTION_LAYER_OPERATIONS.FORWARD);
  assert.deepEqual(forward.tables[4].placements.map(({ id, layer, navigationOrder }) => ({ id, layer, navigationOrder })), [
    { id: 'a', layer: 7, navigationOrder: 0 },
    { id: 'b', layer: 0, navigationOrder: 7 },
    { id: 'c', layer: Number.MAX_SAFE_INTEGER, navigationOrder: 99 },
  ]);
  const backward = candidateFor(forward, 'c', LATTICE_PRODUCTION_LAYER_OPERATIONS.BACKWARD);
  assert.deepEqual(backward.tables[4].placements.map(({ id, layer }) => ({ id, layer })), [
    { id: 'a', layer: Number.MAX_SAFE_INTEGER }, { id: 'b', layer: 0 }, { id: 'c', layer: 7 },
  ]);
  assert.deepEqual(draft, before);
});

test('FRONT and BACK stably rotate existing values while private placements remain exact', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const hidden = placement('private', 3, { visibility: 'PRIVATE', navigationOrder: 3 });
  draft.tables[4].placements = [placement('a', 0), hidden, placement('b', 5), placement('c', 12)];
  const front = candidateFor(draft, 'a', LATTICE_PRODUCTION_LAYER_OPERATIONS.FRONT);
  assert.deepEqual(front.tables[4].placements.map(({ id, layer }) => ({ id, layer })), [
    { id: 'a', layer: 12 }, { id: 'private', layer: 3 }, { id: 'b', layer: 0 }, { id: 'c', layer: 5 },
  ]);
  const back = candidateFor(front, 'a', LATTICE_PRODUCTION_LAYER_OPERATIONS.BACK);
  assert.deepEqual(back.tables[4].placements.map(({ id, layer }) => ({ id, layer })), [
    { id: 'a', layer: 0 }, { id: 'private', layer: 3 }, { id: 'b', layer: 5 }, { id: 'c', layer: 12 },
  ]);
  assert.deepEqual(back.tables[4].placements[1], hidden);
});

test('boundaries and locked barriers are complete no-ops without partial rotation', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [placement('a', 0), placement('locked', 4, { locked: true }), placement('c', 9)];
  assert.equal(candidateFor(draft, 'a', LATTICE_PRODUCTION_LAYER_OPERATIONS.BACK), null);
  assert.equal(candidateFor(draft, 'c', LATTICE_PRODUCTION_LAYER_OPERATIONS.FRONT), null);
  assert.equal(candidateFor(draft, 'a', LATTICE_PRODUCTION_LAYER_OPERATIONS.FORWARD), null);
  assert.equal(candidateFor(draft, 'a', LATTICE_PRODUCTION_LAYER_OPERATIONS.FRONT), null);
  assert.equal(candidateFor(draft, 'c', LATTICE_PRODUCTION_LAYER_OPERATIONS.BACK), null);
});

test('complete selected placement and table topology snapshots reject every stale mutation', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [placement('a', 0), placement('b', 2)];
  const expectedPlacement = structuredClone(draft.tables[4].placements[0]);
  const expectedPlacements = latticeProductionLayerTopologySnapshot(draft.tables[4]);
  draft.tables[4].placements[1].crop = { x: 0.5, y: 0.5, zoom: 1 };
  assert.throws(() => createLatticeProductionLayerCandidate(draft, {
    expectedPlacement, expectedPlacements, operation: 'FORWARD', placementId: 'a', tableId: 'table-05',
  }), { code: 'LATTICE_LAYER_TOPOLOGY_STALE' });
  const currentTopology = latticeProductionLayerTopologySnapshot(draft.tables[4]);
  draft.tables[4].placements[0].column = 2;
  assert.throws(() => createLatticeProductionLayerCandidate(draft, {
    expectedPlacement, expectedPlacements: currentTopology, operation: 'FORWARD', placementId: 'a', tableId: 'table-05',
  }), { code: 'LATTICE_LAYER_PLACEMENT_STALE' });
});

test('invalid and duplicate canonical layer topology is rejected before mutation', () => {
  for (const layers of [[0, 0], [0, -1], [0, 0.5], [0, Number.MAX_SAFE_INTEGER + 1]]) {
    const draft = createEmptyLatticeProductionDraft(PROFILE);
    draft.tables[4].placements = [placement('a', layers[0]), placement('b', layers[1], { navigationOrder: 1 })];
    assert.throws(() => candidateFor(draft, 'a', LATTICE_PRODUCTION_LAYER_OPERATIONS.FORWARD));
  }
});

test('unified toolbar docking keeps bottom-edge and 1 by 1 corner controls table-local', () => {
  assert.deepEqual(latticeProductionPlacementToolbarDock(placement('bottom-left', 0, {
    column: 0, row: 17, columnSpan: 1, rowSpan: 1,
  }), 40), { left: 8, vertical: 'above', width: 180 });
  assert.deepEqual(latticeProductionPlacementToolbarDock(placement('bottom-right', 0, {
    column: 31, row: 17, columnSpan: 1, rowSpan: 1,
  }), 40), { left: -148, vertical: 'above', width: 180 });
  const centered = latticeProductionPlacementToolbarDock(placement('bottom-middle', 0, {
    column: 15, row: 17, columnSpan: 1, rowSpan: 1,
  }), 40);
  assert.equal((15 * 40) + centered.left >= 8, true);
  assert.equal((15 * 40) + centered.left + centered.width <= (32 * 40) - 8, true);
  assert.equal(centered.vertical, 'above');
});

test('unified toolbar prefers below and clamps every top, side, and corner case to the safe inset', () => {
  const cases = [
    ['top-left', { column: 0, row: 0 }, { left: 8, vertical: 'below' }],
    ['top-right', { column: 31, row: 0 }, { left: -148, vertical: 'below' }],
    ['left', { column: 0, row: 8 }, { left: 8, vertical: 'below' }],
    ['right', { column: 31, row: 8 }, { left: -148, vertical: 'below' }],
    ['bottom-left', { column: 0, row: 17 }, { left: 8, vertical: 'above' }],
    ['bottom-right', { column: 31, row: 17 }, { left: -148, vertical: 'above' }],
  ];
  for (const [id, geometry, expected] of cases) {
    const dock = latticeProductionPlacementToolbarDock(placement(id, 0, {
      ...geometry, columnSpan: 1, rowSpan: 1,
    }), 40);
    assert.deepEqual({ left: dock.left, vertical: dock.vertical }, expected, id);
    const tableLeft = (geometry.column * 40) + dock.left;
    assert.ok(tableLeft >= 8, id);
    assert.ok(tableLeft + dock.width <= (32 * 40) - 8, id);
  }
});

test('top plus bottom and full-width placements use deterministic inside and centered docks', () => {
  assert.deepEqual(latticeProductionPlacementToolbarDock(placement('full-height', 0, {
    column: 0, row: 0, columnSpan: 1, rowSpan: 18,
  }), 40), { left: 8, vertical: 'inside-bottom', width: 180 });
  assert.deepEqual(latticeProductionPlacementToolbarDock(placement('full-width', 0, {
    column: 0, row: 0, columnSpan: 32, rowSpan: 1,
  }), 40), { left: 550, vertical: 'below', width: 180 });
  assert.deepEqual(latticeProductionPlacementToolbarDock(placement('inside-top', 0, {
    column: 31, row: 1, columnSpan: 1, rowSpan: 17,
  }), 40), { left: -148, vertical: 'inside-top', width: 180 });
});
