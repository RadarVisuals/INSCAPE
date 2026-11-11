import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { createDisplayModuleSession, addDisplayModule } from './displayModuleSession.js';
import { assertValidSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { expandPlacementGroups, selectedPlacementGroup } from './domain/placementGroups.js';
import { createSystemWorkflowGroupMovementRequest } from './systemWorkflowMovement.js';
import { resizeSystemWorkflowGroupGeometries, systemWorkflowGroupBounds } from './systemWorkflowResize.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { assertValidProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets, OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE as profileAddress } from '../public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';

function setup() {
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const store = createSystemWorkflowDraftStore({ profileAddress, storage });
  const session = createDisplayModuleSession(store, 'display:primary');
  const gridId = session.getState().selectedGridId;
  for (let i = 0; i < 3; i++) session.placeAsset({ gridId, stableAssetId: assets[i].id,
    destination: { column: i * 4, row: i, columnSpan: 4, rowSpan: 4 } });
  const grid = () => session.getState().draft.grids.find(item => item.id === gridId);
  // Nonadjacent layers: grouping must not move the middle artwork in the stack.
  const members = () => [grid().placements[2], grid().placements[0]];
  const selection = () => ({ gridId, placementIds: members().map(item => item.id), expectedPlacements: members() });
  const group = () => grid().groups[0];
  const request = () => ({ gridId, groupId: group().id, expectedGroup: group(), expectedPlacements: members() });
  return { store, session, storage, grid, gridId, members, selection, group, request };
}

test('groups preserve geometry and order, save and undo without rewriting old drafts', () => {
  const f = setup(), original = f.store.getDraft(), p = f.members()[0];
  assert.equal(f.grid().groups, undefined);
  assert.deepEqual(assertValidSystemWorkflowDraft(original), original);
  const placements = f.grid().placements;
  f.session.groupPlacements(f.selection());
  assert.deepEqual(f.grid().placements, placements);
  assert.deepEqual(new Set(expandPlacementGroups(f.grid(), [p.id])), new Set(f.group().placementIds));
  assert.deepEqual(selectedPlacementGroup(f.grid(), f.group().placementIds), f.group());
  assert.deepEqual(f.grid().placements, placements);
  const grouped = f.store.getDraft();
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress, storage: f.storage }).getDraft(), grouped);
  f.session.ungroupPlacements(f.request());
  assert.equal(f.grid().groups, undefined);
  assert.deepEqual(f.grid().placements, placements);
  f.store.undo(); assert.deepEqual(f.store.getDraft(), grouped);
  f.store.redo(); assert.equal(f.grid().groups, undefined);
});

test('group movement, resize, lock, duplicate and removal reuse atomic authoring operations', () => {
  const f = setup(); f.session.groupPlacements(f.selection());
  const before = f.members();
  f.session.movePlacements(createSystemWorkflowGroupMovementRequest(before, { column: 2, row: 1 }, f.gridId));
  f.members().forEach((p, i) => { assert.equal(p.column, before[i].column + 2); assert.equal(p.row, before[i].row + 1); });
  const bounds = systemWorkflowGroupBounds(f.members());
  f.session.resizePlacements({ ...f.selection(), corner: 'se', destinations: resizeSystemWorkflowGroupGeometries(f.members(), { ...bounds, columnSpan: bounds.columnSpan * 2, rowSpan: bounds.rowSpan * 2 }) });
  const p = f.members()[0];
  f.session.setPlacementLocked({ gridId: f.gridId, placementId: p.id, expectedPlacement: p, locked: true });
  assert.ok(f.members().every(p => p.locked));
  assert.throws(() => f.session.ungroupPlacements(f.request()), /Unlock/);
  f.session.setPlacementLocked({ gridId: f.gridId, placementId: p.id, expectedPlacement: f.members()[0], locked: false });
  f.session.duplicatePlacements(f.selection());
  const duplicate = f.grid().groups[1];
  assert.notEqual(duplicate.id, f.group().id);
  assert.ok(duplicate.placementIds.every(id => !f.group().placementIds.includes(id)));
  const copied = duplicate.placementIds.map(id => f.grid().placements.find(p => p.id === id));
  assert.equal(copied[0].stableAssetId, f.members()[0].stableAssetId);
  assert.ok(copied[0].layer > copied[1].layer);
  f.session.removePlacements(f.selection());
  assert.deepEqual(f.grid().groups, [duplicate]);
  f.store.undo(); assert.equal(f.grid().groups.length, 2);
});

test('partial, nested, stale, locked and failed group edits leave saved work intact', () => {
  const f = setup(); f.session.groupPlacements(f.selection());
  const p = f.members()[0], single = { gridId: f.gridId, placementId: p.id, expectedPlacement: p };
  const before = f.store.getDraft();
  for (const operation of [() => f.session.removePlacement(single), () => f.session.duplicatePlacement(single),
    () => f.session.movePlacements(createSystemWorkflowGroupMovementRequest([p], { column: 1, row: 0 }, f.gridId)),
    () => f.session.groupPlacements(f.selection()), () => f.session.applyGutters({ gridId: f.gridId, gutter: 1, expectedPlacements: f.grid().placements })]) {
    assert.throws(operation); assert.deepEqual(f.store.getDraft(), before);
  }
  const stale = f.request();
  f.session.movePlacements(createSystemWorkflowGroupMovementRequest(f.members(), { column: 1, row: 0 }, f.gridId));
  assert.throws(() => f.session.ungroupPlacements(stale), /changed/);
  const saved = f.store.getDraft(), history = f.store.getHistory(), write = f.storage.setItem;
  f.storage.setItem = () => { throw Error('quota'); };
  assert.throws(() => f.session.ungroupPlacements(f.request()), /could not be saved/);
  assert.deepEqual(f.store.getDraft(), saved); assert.deepEqual(f.store.getHistory(), history);
  f.storage.setItem = write; f.session.ungroupPlacements(f.request());
});

test('groups round-trip through public documents and reject dangling or overlapping members', () => {
  const f = setup(); f.session.groupPlacements(f.selection());
  const document = buildProfileDocumentV9({ profileAddress, systemWorkflowDraft: f.store.getDraft(), assetRecords: assets });
  assert.deepEqual(document.grids[0].groups, f.grid().groups);
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(document);
  assert.deepEqual(restored.grids[0].groups, f.grid().groups);
  for (const mutate of [g => { g.groups[0].placementIds[0] = 'missing'; }, g => { g.groups.push({ ...structuredClone(g.groups[0]), id: 'group:other' }); },
    g => { g.groups[0].placementIds.pop(); }, g => { g.groups[0].unexpected = true; }]) {
    const draft = f.store.getDraft(); mutate(draft.grids[0]); assert.throws(() => assertValidSystemWorkflowDraft(draft));
    const publicCopy = structuredClone(document); mutate(publicCopy.grids[0]); assert.throws(() => assertValidProfileDocumentV9(publicCopy));
  }
});

test('groups belong to the originating Display', () => {
  const f = setup(), original = f.store.getDraft().grids, moduleId = addDisplayModule(f.store);
  const session = createDisplayModuleSession(f.store, moduleId), gridId = session.getState().selectedGridId;
  for (let i = 0; i < 2; i++) session.placeAsset({ gridId, stableAssetId: assets[i].id, nativeWidth: 200, nativeHeight: 200 });
  const placements = session.getState().draft.grids[0].placements;
  session.groupPlacements({ gridId, placementIds: placements.map(p => p.id), expectedPlacements: placements });
  const group = session.getState().draft.grids[0].groups[0];
  assert.deepEqual(f.store.getDraft().grids, original);
  assert.deepEqual(f.store.getDraft().displays[0].grids[0].groups[0], group);
  const draft = f.store.getDraft(); draft.displays[0].visibility = 'PUBLIC';
  const document = buildProfileDocumentV9({ profileAddress, systemWorkflowDraft: draft, assetRecords: assets });
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(document).displays[0].grids[0].groups, draft.displays[0].grids[0].groups);
});

test('World Cover groups survive publication and restore with their asset identities', () => {
  const f = setup(), gridId = 'grid:world-cover';
  for (let i = 0; i < 2; i++) f.session.placeAsset({ gridId, stableAssetId: assets[i].id, nativeWidth: 200, nativeHeight: 200 });
  const placements = f.store.getDraft().grids.find(grid => grid.id === gridId).placements;
  f.session.groupPlacements({ gridId, placementIds: placements.map(p => p.id), expectedPlacements: placements });
  const draft = f.store.getDraft(), group = draft.grids.find(grid => grid.id === gridId).groups[0];
  const document = buildProfileDocumentV9({ profileAddress, systemWorkflowDraft: draft, assetRecords: assets });
  assert.deepEqual(document.metadata.worldCover.grid.groups, [group]);
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(document).grids.find(grid => grid.id === gridId);
  assert.deepEqual(restored.groups, [group]);
  assert.deepEqual(restored.placements.map(p => p.stableAssetId), placements.map(p => p.stableAssetId));
});
