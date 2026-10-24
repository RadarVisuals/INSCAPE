import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { addShape } from '../shapes/shapeSession.js';
import { editWorkbenchIndex, openWorkbenchIndex } from './workbenchIndexSession.js';
import { validWorkbenchIndex, resolveWorkbenchDestination } from './domain/workbenchIndex.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { validateProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
const profile = `0x${'3'.repeat(40)}`;
function fixture() {
  const values = new Map(); let fail = false;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('full'); values.set(key, value); } };
  return { storage, fail: value => { fail = value; }, store: createSystemWorkflowDraftStore({ profileAddress: profile, storage }) };
}
const destination = (id, visibility = 'PUBLIC') => ({ id: `workbench-view:${id}`, name: id, visibility, view: { left: 100, top: 200, width: 800, height: 500 } });
const publish = draft => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft, assetRecords: [] });

test('Index create/edit/reorder/delete, undo and reload share completed draft operations', () => {
  const { store, storage } = fixture(), before = store.getDraft();
  openWorkbenchIndex(store, profile);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), before); assert.ok(store.redo());
  let index = store.getDraft().workbenchIndex;
  editWorkbenchIndex(store, profile, index, { ...index, destinations: [destination('one'), destination('two')], landingId: 'workbench-view:one' });
  index = store.getDraft().workbenchIndex;
  editWorkbenchIndex(store, profile, index, { ...index, destinations: [...index.destinations].reverse() });
  index = store.getDraft().workbenchIndex;
  editWorkbenchIndex(store, profile, index, { ...index, destinations: index.destinations.slice(0, 1), landingId: null });
  assert.ok(store.undo()); assert.deepEqual(store.getDraft().workbenchIndex, index);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), store.getDraft());
});
test('following a group translates the authored view; resizing members does not refit it, missing groups retain fixed framing', () => {
  const { store } = fixture(); const id = addShape(store, profile);
  const draft = store.getDraft(); draft.workbenchGroups = [{ id: 'workbench-group:test', name: 'Composition', memberIds: [id] }];
  const item = { ...destination('one'), follow: { groupId: 'workbench-group:test', anchorId: id, origin: { left: 120, top: 120 } } };
  draft.workbench.shapes[0].window = { left: 420, top: 370, width: 2000, height: 1200 };
  assert.deepEqual(resolveWorkbenchDestination(item, draft), { left: 400, top: 450, width: 800, height: 500 });
  assert.deepEqual(resolveWorkbenchDestination(item, { ...draft, workbenchGroups: [] }), item.view);
  assert.deepEqual(draft.workbench.shapes[0].window, { left: 420, top: 370, width: 2000, height: 1200 });
});
test('publication filters private destinations and private group references, including the landing view; old documents load', () => {
  const { store } = fixture(); const old = publish(store.getDraft()), id = addShape(store, profile);
  openWorkbenchIndex(store, profile);
  const draft = store.getDraft();
  draft.workbenchGroups = [{ id: 'workbench-group:private', name: 'Secret', memberIds: [id], visibility: 'PRIVATE' }];
  const privateLink = { ...destination('linked'), follow: { groupId: 'workbench-group:private', anchorId: id, origin: { left: 120, top: 120 } } };
  draft.workbenchIndex = { ...draft.workbenchIndex, destinations: [destination('public'), destination('secret', 'PRIVATE'), privateLink], landingId: privateLink.id };
  assert.ok(store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() }));
  const doc = publish(store.getDraft());
  assert.deepEqual(doc.workbenchIndex.destinations.map(item => item.name), ['public']);
  assert.equal(doc.workbenchIndex.landingId, null);
  assert.equal(JSON.stringify(doc).includes('Secret'), false);
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, store.getDraft());
  assert.deepEqual(restored.workbenchIndex.destinations.map(item => item.name), ['public', 'secret', 'linked']);
  assert.equal(restored.workbenchIndex.destinations[1].visibility, 'PRIVATE');
  assert.ok(validateProfileDocumentV9(old).valid);
  assert.ok(reconcileSystemWorkflowDraftFromProfileDocumentV9(old, store.getDraft()).workbenchIndex);
  const invalid = structuredClone(doc); invalid.workbenchIndex.destinations[0].follow = privateLink.follow;
  assert.equal(validateProfileDocumentV9(invalid).valid, false);
});
test('Index rejects malformed views, unknown fields, duplicate ids and failed/stale saves atomically', () => {
  const f = fixture(); openWorkbenchIndex(f.store, profile); const index = f.store.getDraft().workbenchIndex;
  for (const next of [{ ...index, destinations: [destination('a'), destination('a')] },
    { ...index, landingId: 'workbench-view:missing' }, { ...index, extra: true },
    { ...index, destinations: [{ ...destination('a'), view: { left: 0, top: 0, width: NaN, height: 20 } }] },
    { ...index, destinations: [{ ...destination('a'), follow: null }] }]) assert.equal(validWorkbenchIndex(next, f.store.getDraft()), false);
  f.fail(true);
  assert.throws(() => editWorkbenchIndex(f.store, profile, index, { ...index, open: false }));
  assert.deepEqual(f.store.getDraft().workbenchIndex, index);
  f.fail(false); editWorkbenchIndex(f.store, profile, index, { ...index, open: false });
  assert.throws(() => editWorkbenchIndex(f.store, profile, index, { ...index, pinned: false }));
  assert.throws(() => editWorkbenchIndex(f.store, `0x${'9'.repeat(40)}`, f.store.getDraft().workbenchIndex, index));
});
