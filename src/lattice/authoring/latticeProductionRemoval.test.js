import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../domain/latticeProductionDraft.js';
import {
  createLatticeProductionGroupRemovalCandidate,
  createLatticeProductionRemovalCandidate,
  sameLatticeProductionPlacementSnapshot,
} from './latticeProductionRemoval.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const placement = (id, overrides = {}) => ({
  id, stableAssetId: ASSET, column: 1, row: 2, columnSpan: 4, rowSpan: 3,
  layer: 0, navigationOrder: 0, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false }, ...overrides,
});

test('removal requires the complete expected snapshot and preserves every survivor field and order', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const first = placement('placement-old', { layer: 2, navigationOrder: 5 });
  const removed = placement('placement-remove', { layer: 7, navigationOrder: 9 });
  const last = placement('placement-last', { layer: 12, navigationOrder: 14 });
  draft.tables[4].placements = [first, removed, last];
  const before = structuredClone(draft);
  const candidate = createLatticeProductionRemovalCandidate(draft, {
    tableId: 'table-05', placementId: removed.id, expectedPlacement: structuredClone(removed),
  });
  assert.deepEqual(candidate.tables[4].placements, [first, last]);
  assert.deepEqual(draft, before);
});

test('stale, locked, private, missing, and private-table removals fail closed', () => {
  const cases = [
    ['stale', (draft) => { draft.tables[4].placements[0].column += 1; }, 'LATTICE_REMOVAL_PLACEMENT_STALE', false],
    ['locked', (draft) => { draft.tables[4].placements[0].locked = true; }, 'LATTICE_REMOVAL_PLACEMENT_LOCKED', true],
    ['private placement', (draft) => { draft.tables[4].placements[0].visibility = 'PRIVATE'; }, 'LATTICE_REMOVAL_PLACEMENT_PRIVATE', true],
    ['private table', (draft) => { draft.tables[4].visibility = 'PRIVATE'; }, 'LATTICE_REMOVAL_TABLE_PRIVATE', false],
  ];
  for (const [name, mutate, code, expectCurrent] of cases) {
    const draft = createEmptyLatticeProductionDraft(PROFILE);
    const expected = placement('placement-a');
    draft.tables[4].placements = [structuredClone(expected)];
    mutate(draft);
    const before = structuredClone(draft);
    assert.throws(() => createLatticeProductionRemovalCandidate(draft, {
      tableId: 'table-05', placementId: expected.id,
      expectedPlacement: expectCurrent ? structuredClone(draft.tables[4].placements[0]) : expected,
    }), { code }, name);
    assert.deepEqual(draft, before, name);
  }
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  assert.throws(() => createLatticeProductionRemovalCandidate(draft, {
    tableId: 'table-05', placementId: 'missing', expectedPlacement: placement('missing'),
  }), { code: 'LATTICE_REMOVAL_PLACEMENT_UNKNOWN' });
});

test('snapshot comparison includes nested presentation state', () => {
  const original = placement('placement-a');
  const changed = structuredClone(original);
  changed.mat.inset.left = 0.2;
  assert.equal(sameLatticeProductionPlacementSnapshot(original, structuredClone(original)), true);
  assert.equal(sameLatticeProductionPlacementSnapshot(original, changed), false);
  const transformed = structuredClone(original);
  transformed.transform.quarterTurns = 1;
  assert.equal(sameLatticeProductionPlacementSnapshot(original, transformed), false);
});

test('group removal removes every selected placement atomically and preserves survivors', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const placements = [
    placement('placement-a'),
    placement('placement-b', { layer: 1, navigationOrder: 1 }),
    placement('placement-c', { layer: 2, navigationOrder: 2 }),
  ];
  draft.tables[4].placements = placements;
  const candidate = createLatticeProductionGroupRemovalCandidate(draft, {
    expectedPlacements: structuredClone([placements[0], placements[2]]),
    placementIds: ['placement-a', 'placement-c'],
    tableId: 'table-05',
  });
  assert.deepEqual(candidate.tables[4].placements, [placements[1]]);
  assert.equal(draft.tables[4].placements.length, 3);
});

test('group removal rejects the whole operation when any selected placement is stale or locked', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const placements = [placement('placement-a'), placement('placement-b', { layer: 1, navigationOrder: 1 })];
  draft.tables[4].placements = placements;
  const input = {
    expectedPlacements: structuredClone(placements), placementIds: placements.map(({ id }) => id), tableId: 'table-05',
  };
  draft.tables[4].placements[1].locked = true;
  assert.throws(() => createLatticeProductionGroupRemovalCandidate(draft, {
    ...input, expectedPlacements: structuredClone(draft.tables[4].placements),
  }), {
    code: 'LATTICE_REMOVAL_PLACEMENT_LOCKED',
  });
});
