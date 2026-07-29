import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../domain/latticeProductionDraft.js';
import {
  createInitialLatticeProductionPlacementGeometry,
  createLatticeProductionPlacementCandidate,
  findFirstUnusedLatticeProductionPlacementId,
} from './latticeProductionPlacement.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const placement = (id, overrides = {}) => ({
  id, stableAssetId: ASSET, column: 0, row: 0, columnSpan: 2, rowSpan: 2,
  layer: 0, navigationOrder: 0, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: 'PUBLIC', locked: false, ...overrides,
});

test('initial geometry uses the approved provisional 12 by 10 integer envelope', () => {
  assert.deepEqual(createInitialLatticeProductionPlacementGeometry(1, 1), { column: 11, row: 4, columnSpan: 10, rowSpan: 10 });
  assert.deepEqual(createInitialLatticeProductionPlacementGeometry(2, 3), { column: 12, row: 4, columnSpan: 7, rowSpan: 10 });
  assert.deepEqual(createInitialLatticeProductionPlacementGeometry(3, 2), { column: 10, row: 5, columnSpan: 12, rowSpan: 8 });
  assert.deepEqual(createInitialLatticeProductionPlacementGeometry(9, 16), { column: 13, row: 4, columnSpan: 6, rowSpan: 10 });
  assert.deepEqual(createInitialLatticeProductionPlacementGeometry(16, 9), { column: 10, row: 5, columnSpan: 12, rowSpan: 7 });
  assert.deepEqual(createInitialLatticeProductionPlacementGeometry(1, 1000), { column: 15, row: 4, columnSpan: 1, rowSpan: 10 });
  assert.deepEqual(createInitialLatticeProductionPlacementGeometry(1000, 1), { column: 10, row: 8, columnSpan: 12, rowSpan: 1 });
  for (const dimensions of [[0, 10], [10, 0], [NaN, 1], [1, Infinity]]) {
    assert.throws(() => createInitialLatticeProductionPlacementGeometry(...dimensions), { code: 'LATTICE_PLACEMENT_DIMENSIONS_UNAVAILABLE' });
  }
});

test('placement IDs are global, deterministic, gap filling, and bounded', () => {
  assert.equal(findFirstUnusedLatticeProductionPlacementId([]), 'placement-1');
  assert.equal(findFirstUnusedLatticeProductionPlacementId(['placement-1', 'placement-3', 'hero-work']), 'placement-2');
  assert.throws(() => findFirstUnusedLatticeProductionPlacementId(['placement-1'], {
    candidateForIndex: () => 'invalid id', maximumAttempts: 2,
  }), { code: 'LATTICE_PLACEMENT_ID_EXHAUSTED' });
});

test('complete candidates use global IDs, first-unused orders, and exact canonical defaults', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[0].placements = [placement('placement-1')];
  draft.tables[4].placements = [placement('placement-3', { layer: 1, navigationOrder: 2 })];
  const before = structuredClone(draft);
  const input = { nativeHeight: 3, nativeWidth: 2, stableAssetId: ASSET, tableId: 'table-05' };
  const first = createLatticeProductionPlacementCandidate(draft, input);
  assert.deepEqual(first, createLatticeProductionPlacementCandidate(draft, input));
  assert.deepEqual(draft, before);
  assert.deepEqual(first.tables[4].placements[1], {
    id: 'placement-2', stableAssetId: ASSET, column: 12, row: 4, columnSpan: 7, rowSpan: 10,
    layer: 0, navigationOrder: 0, crop: null, frameId: 'NONE',
    mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
    backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO', visibility: 'PUBLIC', locked: false,
  });
});

test('same assets may repeat while invalid drafts, assets, tables, and private targets fail closed', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const input = { nativeHeight: 1, nativeWidth: 1, stableAssetId: ASSET, tableId: 'table-05' };
  const once = createLatticeProductionPlacementCandidate(draft, input);
  const twice = createLatticeProductionPlacementCandidate(once, input);
  assert.deepEqual(twice.tables[4].placements.map(({ id, stableAssetId }) => ({ id, stableAssetId })), [
    { id: 'placement-1', stableAssetId: ASSET }, { id: 'placement-2', stableAssetId: ASSET },
  ]);
  assert.throws(() => createLatticeProductionPlacementCandidate({ ...draft, tables: [] }, input));
  assert.throws(() => createLatticeProductionPlacementCandidate(draft, { ...input, stableAssetId: 'invalid' }), { code: 'LATTICE_PLACEMENT_ASSET_INVALID' });
  assert.throws(() => createLatticeProductionPlacementCandidate(draft, { ...input, tableId: 'missing' }), { code: 'LATTICE_PLACEMENT_TABLE_UNKNOWN' });
  draft.tables[4].visibility = 'PRIVATE';
  assert.throws(() => createLatticeProductionPlacementCandidate(draft, input), { code: 'LATTICE_PLACEMENT_TABLE_PRIVATE' });
});
