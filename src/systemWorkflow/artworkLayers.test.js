import test from 'node:test';
import assert from 'node:assert/strict';
import { layersDraft, layersProfile as profile } from '../../browser-tests/fixtures/artwork-layers.js';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from './systemWorkflowDraftStore.js';
import { artworkLayers, layerIds, validArtworkLayers, reorderArtwork } from './domain/artworkLayers.js';
import { editArtworkLayers } from './artworkLayerSession.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { validateProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { addImageModule } from '../imageModule/imageModuleSession.js';
import { moveWorkbenchGroup } from './moveWorkbenchGroup.js';
import { FIRST_WORKBENCH_ID } from './domain/workbenchCollection.js';
function setup() {
  const values = new Map([[systemWorkflowDraftKey(profile), JSON.stringify(layersDraft())]]);
  let fail = false;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('full'); values.set(key, value); } };
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  const edit = action => editArtworkLayers(store, profile, action);
  return { store, edit, storage, values, fail: value => { fail = value; } };
}
const group = { type: 'group', ids: ['image:body', 'image:eyes'], id: 'composition:person', name: 'Secret person' };
const publish = draft => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft });
test('formation anchors at the frontmost member and preserves content/geometry through one Undo, Redo and reload', () => {
  const f = setup(), before = f.store.getDraft(); f.edit(group);
  const after = f.store.getDraft();
  assert.deepEqual(after.artworkLayers, ['shape:landscape', 'text:mist', { id: group.id, name: group.name, children: group.ids }]);
  assert.deepEqual(after.workbench, before.workbench); assert.deepEqual(after.imageModules, before.imageModules);
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft(), before);
  assert.ok(f.store.redo()); assert.deepEqual(f.store.getDraft(), after);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage }).getDraft(), after);
});
test('ordering and drops move whole blocks or reorder parts without splitting them', () => {
  const f = setup(); f.edit(group);
  f.edit({ type: 'order', ids: group.ids, direction: 'backward' });
  assert.deepEqual(layerIds(artworkLayers(f.store.getDraft())), ['shape:landscape', ...group.ids, 'text:mist']);
  f.edit({ type: 'order', ids: ['image:eyes'], direction: 'back' });
  assert.deepEqual(f.store.getDraft().artworkLayers[1].children, [...group.ids].reverse());
  f.edit({ type: 'order', ids: ['text:mist'], direction: 'drop', targetId: 'image:eyes', edge: 'before' });
  assert.equal(f.store.getDraft().artworkLayers[1], 'text:mist');
  assert.throws(() => f.edit({ type: 'order', ids: ['image:eyes'], direction: 'drop', targetId: 'shape:landscape' }), /within this block/);
  f.edit({ type: 'leave', id: 'image:eyes' });
  assert.equal(f.store.getDraft().artworkLayers.at(-1), 'image:eyes');
});
test('invalid/duplicate/missing members, nested and empty blocks are rejected', () => {
  const draft = layersDraft();
  for (const layers of [null, {}, ['image:body'], [...draft.artworkLayers, 'image:body'], [{ id: group.id, name: group.name, children: [] }],
    [{ id: group.id, name: group.name, children: [{ id: 'nested' }] }]]) assert.equal(validArtworkLayers(layers, draft), false);
});
test('failed and stale operations preserve accepted bytes, history and the whole composition', () => {
  const f = setup(), before = f.store.getDraft(), raw = f.storage.getItem(systemWorkflowDraftKey(profile)), history = f.store.getHistory();
  f.fail(true); assert.throws(() => f.edit(group), /Could not save/);
  assert.deepEqual(f.store.getDraft(), before); assert.deepEqual(f.store.getHistory(), history); assert.equal(f.storage.getItem(systemWorkflowDraftKey(profile)), raw);
  f.fail(false); const generation = f.store.getGeneration(); f.edit(group);
  assert.throws(() => editArtworkLayers(f.store, profile, { type: 'delete', ids: group.ids }, generation), /changed/);
});
test('batch deletion and Undo preserve sides, shared source, live layout, blocks and navigation membership', () => {
  const f = setup(); f.edit(group);
  const draft = f.store.getDraft(); draft.workbenchGroups = [{ id: 'workbench-group:old', name: 'Old navigation', memberIds: group.ids }];
  assert.ok(f.store.commitCompletedOperation(draft, { expectedGeneration: f.store.getGeneration() }));
  const before = f.store.getDraft(); f.edit({ type: 'delete', ids: ['image:eyes', 'text:mist'] });
  assert.deepEqual(f.store.getDraft().imageModules, before.imageModules.slice(0, 1));
  assert.deepEqual(f.store.getDraft().workbenchGroups[0].memberIds, ['image:body']);
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft(), before);
  assert.ok(f.store.redo()); assert.equal(f.store.getDraft().imageModules.length, 1);
});
test('additions append once; public order filters private content and never exposes block names', () => {
  const f = setup(); f.edit(group); const added = addImageModule(f.store, profile);
  assert.equal(layerIds(artworkLayers(f.store.getDraft())).at(-1), added);
  const document = publish(f.store.getDraft());
  assert.deepEqual(document.artworkLayers, ['shape:landscape', 'text:mist', ...group.ids]);
  assert.equal(JSON.stringify(document).includes('Secret person'), false);
  assert.equal(JSON.stringify(document).includes(added), false);
  assert.equal(validateProfileDocumentV9(document).valid, true);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(document, f.store.getDraft()).artworkLayers, f.store.getDraft().artworkLayers);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(document).artworkLayers, document.artworkLayers);
});
test('block movement is atomic, restores geometry and rejects failed storage', () => {
  const f = setup(); f.edit(group); const before = f.store.getDraft();
  const changes = before.workbench.imageModules.map(item => ({ id: item.id, left: item.position.left + 50, top: item.position.top + 30 }));
  moveWorkbenchGroup(f.store, profile, changes, before.workbench);
  assert.equal(f.store.getDraft().workbench.imageModules[1].position.left, 430);
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft(), before);
  f.fail(true); assert.throws(() => moveWorkbenchGroup(f.store, profile, changes, before.workbench)); assert.deepEqual(f.store.getDraft(), before);
});
test('delete captures a live unsaved layout in the same write and Undo restores it', () => {
  const f = setup(), live = structuredClone(f.store.getDraft().workbench);
  live.imageModules[0].position = { left: 800, top: 900 };
  editArtworkLayers(f.store, profile, { type: 'delete', ids: ['image:body'] }, f.store.getGeneration(), live);
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft().workbench, live);
  assert.ok(f.store.redo()); assert.equal(f.store.getDraft().imageModules.length, 1);
});

test('order and blocks remain scoped to their Workbench through switching, Undo and reload', () => {
  const f = setup(); f.edit(group); const a = f.store.getDraft();
  const bId = f.store.createWorkbench('Studies'), imageId = addImageModule(f.store, profile);
  f.edit({ type: 'order', ids: [imageId], direction: 'front' });
  const b = f.store.getDraft();
  assert.ok(f.store.switchWorkbench(FIRST_WORKBENCH_ID)); assert.deepEqual(f.store.getDraft(), a);
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft().artworkLayers, layersDraft().artworkLayers);
  assert.ok(f.store.switchWorkbench(bId)); assert.deepEqual(f.store.getDraft(), b);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage }).getDraft(), b);
});

test('a private block member is filtered without losing local grouping on reconcile', () => {
  const f = setup(); f.edit(group); const draft = f.store.getDraft();
  draft.imageModules[1].visibility = 'PRIVATE';
  assert.ok(f.store.commitCompletedOperation(draft, { expectedGeneration: f.store.getGeneration() }));
  const document = publish(f.store.getDraft());
  assert.deepEqual(document.artworkLayers, ['shape:landscape', 'text:mist', 'image:body']);
  assert.equal(JSON.stringify(document).includes('image:eyes'), false);
  assert.equal(validateProfileDocumentV9(document).valid, true);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(document, f.store.getDraft()).artworkLayers, draft.artworkLayers);
});

test('block movement rejects a stale gesture and restores unsaved live positions with Undo', () => {
  const f = setup(); f.edit(group); const generation = f.store.getGeneration();
  f.edit({ type: 'order', ids: group.ids, direction: 'back' });
  assert.throws(() => moveWorkbenchGroup(f.store, profile, [], f.store.getDraft().workbench, generation), /changed/);
  const live = structuredClone(f.store.getDraft().workbench); live.imageModules[0].position.left = 800;
  moveWorkbenchGroup(f.store, profile, [{ id: 'image:body', left: 850, top: 180 }, { id: 'image:eyes', left: 430, top: 280 }], live);
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft().workbench, live);
});
