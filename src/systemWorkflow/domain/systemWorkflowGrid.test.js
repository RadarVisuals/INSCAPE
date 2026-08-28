import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from './systemWorkflowDraft.js';
import {
  createSystemWorkflowGridCandidate,
  createSystemWorkflowGridDeleteCandidate,
  createSystemWorkflowGridRenameCandidate,
  createSystemWorkflowGridReorderCandidate,
  createSystemWorkflowGridVisibilityCandidate,
  inspectSystemWorkflowGridDeletion,
  systemWorkflowGridFingerprint,
  systemWorkflowGridOrder,
} from './systemWorkflowGrid.js';
import {
  adjacentSystemWorkflowGridId,
  firstSystemWorkflowGridId,
  reconcileSystemWorkflowGridSelection,
} from './systemWorkflowNavigation.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const initial = () => createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' });
const placement = () => ({
  id: 'placement-a', stableAssetId: ASSET, column: 1, row: 1, columnSpan: 4, rowSpan: 3,
  layer: 0, navigationOrder: 0, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
});

test('dynamic Grid CRUD appends private Grids, preserves IDs, and deletes only with exact impact', () => {
  const home = initial();
  const created = createSystemWorkflowGridCandidate(home, { generateId: () => 'second' });
  assert.deepEqual(created.grids.map(({ id, title, visibility }) => ({ id, title, visibility })), [
    { id: 'grid:home', title: 'HOME', visibility: 'PUBLIC' },
    { id: 'grid:second', title: 'GRID 02', visibility: 'PRIVATE' },
    { id: 'grid:world-cover', title: 'WORLD COVER', visibility: 'PUBLIC' },
  ]);
  const renamed = createSystemWorkflowGridRenameCandidate(created, {
    expectedGridFingerprint: systemWorkflowGridFingerprint(created.grids[1]),
    gridId: 'grid:second', name: '  Archive   Room  ',
  });
  const visible = createSystemWorkflowGridVisibilityCandidate(renamed, {
    expectedGridFingerprint: systemWorkflowGridFingerprint(renamed.grids[1]),
    gridId: 'grid:second', visibility: 'PUBLIC',
  });
  assert.equal(visible.grids[1].title, 'Archive Room');
  assert.equal(visible.grids[1].visibility, 'PUBLIC');
  assert.equal(home.grids.length, 2);

  const impact = inspectSystemWorkflowGridDeletion(visible, { gridId: 'grid:second' });
  assert.throws(
    () => createSystemWorkflowGridDeleteCandidate(visible, {
      gridId: 'grid:second', confirmation: { ...impact, title: 'stale' },
    }),
    { code: 'SYSTEM_WORKFLOW_GRID_DELETE_CONFIRMATION_STALE' },
  );
  const deleted = createSystemWorkflowGridDeleteCandidate(visible, {
    gridId: 'grid:second', confirmation: impact,
  });
  assert.deepEqual(deleted.grids.map(({ id }) => id), ['grid:home', 'grid:world-cover']);
  assert.throws(
    () => createSystemWorkflowGridDeleteCandidate(deleted, {
      gridId: 'grid:home', confirmation: inspectSystemWorkflowGridDeletion(deleted, { gridId: 'grid:home' }),
    }),
    { code: 'SYSTEM_WORKFLOW_GRID_LAST' },
  );
});

test('rename and visibility are no-ops only for a fresh exact Grid fingerprint', () => {
  const draft = initial();
  const fingerprint = systemWorkflowGridFingerprint(draft.grids[0]);
  assert.equal(createSystemWorkflowGridRenameCandidate(draft, {
    expectedGridFingerprint: fingerprint, gridId: 'grid:home', name: 'HOME',
  }), null);
  assert.equal(createSystemWorkflowGridVisibilityCandidate(draft, {
    expectedGridFingerprint: fingerprint, gridId: 'grid:home', visibility: 'PUBLIC',
  }), null);
  const changed = structuredClone(draft);
  changed.grids[0].subtitle = 'changed elsewhere';
  assert.throws(() => createSystemWorkflowGridRenameCandidate(changed, {
    expectedGridFingerprint: fingerprint, gridId: 'grid:home', name: 'ARCHIVE',
  }), { code: 'SYSTEM_WORKFLOW_GRID_STALE' });
  assert.throws(() => createSystemWorkflowGridVisibilityCandidate(changed, {
    expectedGridFingerprint: fingerprint, gridId: 'grid:home', visibility: 'PRIVATE',
  }), { code: 'SYSTEM_WORKFLOW_GRID_STALE' });
});

test('reorder is atomic, stale-safe, and ordered navigation has no coordinates', () => {
  let draft = createSystemWorkflowGridCandidate(initial(), { generateId: () => 'second' });
  draft = createSystemWorkflowGridCandidate(draft, { generateId: () => 'third' });
  const order = systemWorkflowGridOrder(draft);
  const reordered = createSystemWorkflowGridReorderCandidate(draft, {
    expectedOrder: order,
    gridId: 'grid:third',
    toIndex: 0,
  });
  assert.deepEqual(systemWorkflowGridOrder(reordered), ['grid:third', 'grid:home', 'grid:second']);
  assert.equal(firstSystemWorkflowGridId(reordered), 'grid:third');
  assert.equal(adjacentSystemWorkflowGridId(reordered, 'grid:third', 'next'), 'grid:home');
  assert.equal(adjacentSystemWorkflowGridId(reordered, 'grid:third', 'previous'), null);
  assert.equal(reconcileSystemWorkflowGridSelection(reordered, 'grid:missing'), 'grid:third');
  assert.throws(
    () => createSystemWorkflowGridReorderCandidate(reordered, {
      expectedOrder: order,
      gridId: 'grid:home',
      toIndex: 2,
    }),
    { code: 'SYSTEM_WORKFLOW_GRID_ORDER_STALE' },
  );
  assert.ok(reordered.grids.every((grid) => !Object.hasOwn(grid, 'coordinate')));
});

test('the Grid lifecycle reaches 24 and rejects the twenty-fifth', () => {
  let draft = initial();
  while (draft.grids.filter(({ id }) => id !== 'grid:world-cover').length < 24) {
    const id = `generated-${draft.grids.length}`;
    draft = createSystemWorkflowGridCandidate(draft, { generateId: () => id });
  }
  assert.equal(draft.grids.length, 25);
  assert.throws(
    () => createSystemWorkflowGridCandidate(draft, { generateId: () => 'overflow' }),
    { code: 'SYSTEM_WORKFLOW_GRID_LIMIT_REACHED' },
  );
});

test('delete confirmation fingerprints the complete canonical serialized Grid', () => {
  const draft = createSystemWorkflowGridCandidate(initial(), { generateId: () => 'second' });
  draft.grids[1].placements = [placement()];
  const confirmation = inspectSystemWorkflowGridDeletion(draft, { gridId: 'grid:second' });
  for (const mutate of [
    (grid) => { grid.placements[0].column = 2; },
    (grid) => { grid.placements[0].crop = { x: 0.5, y: 0.5, zoom: 1 }; },
    (grid) => { grid.placements[0].locked = true; },
    (grid) => { grid.placements[0].frameId = 'DOSSIER'; },
  ]) {
    const changed = structuredClone(draft);
    mutate(changed.grids[1]);
    assert.notEqual(
      systemWorkflowGridFingerprint(changed.grids[1]),
      confirmation.fingerprint,
    );
    assert.throws(() => createSystemWorkflowGridDeleteCandidate(changed, {
      gridId: 'grid:second', confirmation,
    }), { code: 'SYSTEM_WORKFLOW_GRID_DELETE_CONFIRMATION_STALE' });
  }
});
