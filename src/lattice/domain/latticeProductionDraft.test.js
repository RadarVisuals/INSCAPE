import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LATTICE_PRODUCTION_COORDINATES,
  LATTICE_PRODUCTION_ENTRY_COORDINATE,
  LATTICE_PRODUCTION_VISIBILITY,
  createEmptyLatticeProductionDraft,
  validateLatticeProductionDraft,
} from './latticeProductionDraft.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const placement = (overrides = {}) => ({
  id: 'placement-a', stableAssetId: ASSET,
  column: 0, row: 0, columnSpan: 8, rowSpan: 6,
  layer: 0, navigationOrder: 0, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: LATTICE_PRODUCTION_VISIBILITY.PUBLIC, locked: false, ...overrides,
});

test('production drafts fix the 32 by 18 authored plane and permanent row-major topology', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE.toUpperCase().replace('0X', '0x'));
  assert.deepEqual(draft.geometry, { columns: 32, rows: 18 });
  assert.deepEqual(LATTICE_PRODUCTION_ENTRY_COORDINATE, { x: 0, y: 0 });
  assert.deepEqual(draft.tables.map(({ coordinate }) => coordinate), LATTICE_PRODUCTION_COORDINATES);
  assert.deepEqual(draft.tables.map(({ id }) => id), [
    'table-01', 'table-02', 'table-03', 'table-04', 'table-05',
    'table-06', 'table-07', 'table-08', 'table-09',
  ]);
  assert.equal(Object.hasOwn(draft, 'activeTable'), false);
  assert.equal(validateLatticeProductionDraft(draft).valid, true);
});

test('draft validation requires bounded integer cell geometry and controlled presentation values', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements.push(placement({ column: 24, row: 12 }));
  assert.equal(validateLatticeProductionDraft(draft).valid, true);

  for (const invalid of [
    { column: 24.5 }, { row: -1 }, { columnSpan: 0 }, { rowSpan: 0 },
    { column: 25 }, { row: 13 },
  ]) {
    draft.tables[4].placements[0] = placement(invalid);
    assert.ok(validateLatticeProductionDraft(draft).errors.some(({ code }) => code === 'invalid_placement_geometry'));
  }
  draft.tables[4].placements[0] = placement({ frameId: 'POLAROID' });
  assert.ok(validateLatticeProductionDraft(draft).errors.some(({ code }) => code === 'invalid_frame'));
  draft.tables[4].placements[0] = placement({ transparencyMode: 'GUESS' });
  assert.ok(validateLatticeProductionDraft(draft).errors.some(({ code }) => code === 'invalid_transparency'));
});

test('draft validation makes layer, navigation order, placement ID, and all table slots deterministic', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [placement(), placement({ id: 'placement-b', layer: 0, navigationOrder: 1 })];
  assert.ok(validateLatticeProductionDraft(draft).errors.some(({ code }) => code === 'duplicate_layer'));
  draft.tables[4].placements[1] = placement({ id: 'placement-b', layer: 1, navigationOrder: 0 });
  assert.ok(validateLatticeProductionDraft(draft).errors.some(({ code }) => code === 'duplicate_navigation_order'));
  draft.tables[4].placements[1] = placement({ layer: 1, navigationOrder: 1 });
  assert.ok(validateLatticeProductionDraft(draft).errors.some(({ code }) => code === 'duplicate_placement_id'));

  const reordered = createEmptyLatticeProductionDraft(PROFILE);
  [reordered.tables[0], reordered.tables[1]] = [reordered.tables[1], reordered.tables[0]];
  assert.ok(validateLatticeProductionDraft(reordered).errors.some(({ code }) => code === 'invalid_table_order'));
});

test('draft schema rejects runtime, official identity, publication, and unknown state', () => {
  for (const field of ['activeTable', 'cameraOffset', 'selection', 'wallet', 'cid', 'exportedAt']) {
    const draft = createEmptyLatticeProductionDraft(PROFILE);
    draft[field] = field;
    assert.ok(validateLatticeProductionDraft(draft).errors.some(({ code }) => code === 'invalid_draft_structure'));
  }
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.identityPresentation.officialHandle = '@not-owner-authored';
  assert.ok(validateLatticeProductionDraft(draft).errors.some(({ code }) => code === 'invalid_identity_structure'));
});
