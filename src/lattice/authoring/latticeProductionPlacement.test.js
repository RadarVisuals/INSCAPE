import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../domain/latticeProductionDraft.js';
import {
  createInitialLatticeProductionPlacementGeometry,
  createLatticeProductionPlacementId,
  createLatticeProductionPlacementCandidate,
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

test('placement IDs use injected collision-resistant candidates with bounded collision checking', () => {
  const candidates = ['placement-existing', 'placement-550e8400-e29b-41d4-a716-446655440000'];
  assert.equal(createLatticeProductionPlacementId(['placement-existing'], {
    generateCandidate: (attempt) => candidates[attempt - 1],
  }), candidates[1]);
  assert.throws(() => createLatticeProductionPlacementId([], {
    generateCandidate: () => 'invalid id',
  }), { code: 'LATTICE_PLACEMENT_ID_CANDIDATE_INVALID' });
  assert.throws(() => createLatticeProductionPlacementId(['placement-collision'], {
    generateCandidate: () => 'placement-collision', maximumAttempts: 2,
  }), { code: 'LATTICE_PLACEMENT_ID_EXHAUSTED' });
  assert.throws(() => createLatticeProductionPlacementId([], {
    generateCandidate: () => { throw new Error('entropy unavailable'); },
  }), { code: 'LATTICE_PLACEMENT_ID_GENERATION_FAILED' });
});

test('complete candidates use generated global IDs, max plus one orders, and exact canonical defaults', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[0].placements = [placement('placement-1')];
  draft.tables[4].placements = [placement('placement-3', { layer: 1, navigationOrder: 2 })];
  const before = structuredClone(draft);
  const input = { generatePlacementId: () => 'placement-new', nativeHeight: 3, nativeWidth: 2, stableAssetId: ASSET, tableId: 'table-05' };
  const first = createLatticeProductionPlacementCandidate(draft, input);
  assert.deepEqual(first, createLatticeProductionPlacementCandidate(draft, input));
  assert.deepEqual(draft, before);
  assert.deepEqual(first.tables[4].placements[1], {
    id: 'placement-new', stableAssetId: ASSET, column: 12, row: 4, columnSpan: 7, rowSpan: 10,
    layer: 2, navigationOrder: 3, crop: null, frameId: 'NONE',
    mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
    backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO', visibility: 'PUBLIC', locked: false,
  });
});

test('same assets may repeat while invalid drafts, assets, tables, and private targets fail closed', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  let nextId = 0;
  const input = { generatePlacementId: () => `placement-uuid-${++nextId}`, nativeHeight: 1, nativeWidth: 1, stableAssetId: ASSET, tableId: 'table-05' };
  const once = createLatticeProductionPlacementCandidate(draft, input);
  const twice = createLatticeProductionPlacementCandidate(once, input);
  assert.deepEqual(twice.tables[4].placements.map(({ id, stableAssetId }) => ({ id, stableAssetId })), [
    { id: 'placement-uuid-1', stableAssetId: ASSET }, { id: 'placement-uuid-2', stableAssetId: ASSET },
  ]);
  assert.throws(() => createLatticeProductionPlacementCandidate({ ...draft, tables: [] }, input));
  assert.throws(() => createLatticeProductionPlacementCandidate(draft, { ...input, stableAssetId: 'invalid' }), { code: 'LATTICE_PLACEMENT_ASSET_INVALID' });
  assert.throws(() => createLatticeProductionPlacementCandidate(draft, { ...input, tableId: 'missing' }), { code: 'LATTICE_PLACEMENT_TABLE_UNKNOWN' });
  draft.tables[4].visibility = 'PRIVATE';
  assert.throws(() => createLatticeProductionPlacementCandidate(draft, input), { code: 'LATTICE_PLACEMENT_TABLE_PRIVATE' });
});

test('removed order gaps are never filled and safe-integer exhaustion fails before mutation', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [
    placement('placement-1', { layer: 0, navigationOrder: 0 }),
    placement('placement-3', { layer: 7, navigationOrder: 9 }),
  ];
  const input = { generatePlacementId: () => 'placement-uuid-new', nativeHeight: 1, nativeWidth: 1, stableAssetId: ASSET, tableId: 'table-05' };
  const candidate = createLatticeProductionPlacementCandidate(draft, input);
  assert.deepEqual(candidate.tables[4].placements.at(-1), {
    ...candidate.tables[4].placements.at(-1), layer: 8, navigationOrder: 10,
  });
  const exhausted = structuredClone(draft);
  exhausted.tables[4].placements[1].layer = Number.MAX_SAFE_INTEGER;
  const before = structuredClone(exhausted);
  assert.throws(() => createLatticeProductionPlacementCandidate(exhausted, input), {
    code: 'LATTICE_PLACEMENT_ORDER_EXHAUSTED',
  });
  assert.deepEqual(exhausted, before);
});
