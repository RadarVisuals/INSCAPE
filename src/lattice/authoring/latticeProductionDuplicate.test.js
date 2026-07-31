import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../domain/latticeProductionDraft.js';
import {
  createLatticeProductionDuplicateCandidate,
  createLatticeProductionGroupDuplicateCandidate,
} from './latticeProductionDuplicate.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const placement = (overrides = {}) => ({
  id: 'placement-1', stableAssetId: ASSET, column: 2, row: 3, columnSpan: 6, rowSpan: 4,
  layer: 2, navigationOrder: 4, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 1, mirrorX: true, mirrorY: false }, ...overrides,
});

test('duplicate preserves presentation, offsets safely, and moves the copy to the front', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [placement()];
  const before = structuredClone(draft);
  const result = createLatticeProductionDuplicateCandidate(draft, {
    expectedPlacement: draft.tables[4].placements[0], generatePlacementId: () => 'placement-copy',
    placementId: 'placement-1', tableId: 'table-05',
  });
  assert.equal(result.placementId, 'placement-copy');
  assert.deepEqual(result.draft.tables[4].placements[1], {
    ...draft.tables[4].placements[0], id: 'placement-copy', column: 3, row: 4,
    layer: 3, navigationOrder: 5,
  });
  assert.deepEqual(draft, before);
});

test('duplicate rejects stale, locked, and exhausted operations', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [placement()];
  const input = { expectedPlacement: draft.tables[4].placements[0], generatePlacementId: () => 'placement-copy', placementId: 'placement-1', tableId: 'table-05' };
  assert.throws(() => createLatticeProductionDuplicateCandidate(draft, {
    ...input, expectedPlacement: { ...input.expectedPlacement, column: 1 },
  }), { code: 'LATTICE_DUPLICATE_STALE_PLACEMENT' });
  draft.tables[4].placements[0].locked = true;
  assert.throws(() => createLatticeProductionDuplicateCandidate(draft, input), { code: 'LATTICE_DUPLICATE_PLACEMENT_LOCKED' });
  draft.tables[4].placements[0].locked = false;
  draft.tables[4].placements[0].layer = Number.MAX_SAFE_INTEGER;
  assert.throws(() => createLatticeProductionDuplicateCandidate(draft, input), { code: 'LATTICE_DUPLICATE_ORDER_EXHAUSTED' });
});

test('group duplicate preserves composition with one shared offset and deterministic front order', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const sources = [
    placement(),
    placement({ id: 'placement-2', column: 14, row: 8, layer: 7, navigationOrder: 9 }),
  ];
  draft.tables[4].placements = sources;
  const ids = ['placement-copy-1', 'placement-copy-2'];
  const result = createLatticeProductionGroupDuplicateCandidate(draft, {
    expectedPlacements: structuredClone(sources),
    generatePlacementId: () => ids.shift(),
    placementIds: sources.map(({ id }) => id),
    tableId: 'table-05',
  });
  assert.deepEqual(result.placementIds, ['placement-copy-1', 'placement-copy-2']);
  assert.deepEqual(result.draft.tables[4].placements.slice(2).map(({ id, column, row, layer, navigationOrder }) => ({
    id, column, row, layer, navigationOrder,
  })), [
    { id: 'placement-copy-1', column: 3, row: 4, layer: 8, navigationOrder: 10 },
    { id: 'placement-copy-2', column: 15, row: 9, layer: 9, navigationOrder: 11 },
  ]);
});

test('group duplicate rejects the whole operation when any selected placement is stale or locked', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const sources = [placement(), placement({ id: 'placement-2', layer: 3, navigationOrder: 5 })];
  draft.tables[4].placements = sources;
  const input = {
    expectedPlacements: structuredClone(sources), placementIds: sources.map(({ id }) => id), tableId: 'table-05',
  };
  draft.tables[4].placements[1].locked = true;
  assert.throws(() => createLatticeProductionGroupDuplicateCandidate(draft, input), {
    code: 'LATTICE_DUPLICATE_PLACEMENT_LOCKED',
  });
});
