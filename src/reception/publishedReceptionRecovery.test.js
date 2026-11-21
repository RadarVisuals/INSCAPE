import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { addShape } from '../shapes/shapeSession.js';
import { createReceptionEditorScope } from './receptionEditorScope.js';
import { preparePublishedReception, preparePreviousReception, readReceptionRecovery, receptionRecoveryKey, restorePreparedReception } from './publishedReceptionRecovery.js';

const profile = '0x' + '6'.repeat(40), other = '0x' + '7'.repeat(40);
function fixture(address = profile) {
  const records = new Map(); let failure = null;
  const storage = { getItem: key => records.get(key) ?? null, setItem(key, value) {
    if (failure === key || failure === '*') throw Error('Storage full'); records.set(key, value);
  }, removeItem: key => records.delete(key) };
  const root = createSystemWorkflowDraftStore({ profileAddress: address, storage });
  addShape(root, address, { position: { left: 40, top: 40 }, size: { width: 120, height: 100 } });
  root.createWorkbench('Private experiments');
  const scope = createReceptionEditorScope(root);
  const id = addShape(scope, address, { position: { left: 100, top: 100 }, size: { width: 320, height: 240 } });
  scope.turnShapeIntoCell(id);
  return { root, scope, storage, id, records, fail: key => { failure = key; } };
}
function publication(address = profile) {
  const f = fixture(address);
  const draft = f.root.getDraft();
  draft.reception.shapes[0].color = '#cc2222';
  const document = buildProfileDocumentV9({ profileAddress: address, systemWorkflowDraft: draft, assetRecords: [] });
  return { status: 'RESOLVED', document };
}
const canvasPart = ({ reception, ...draft }) => draft;

test('published Reception replaces only Reception, retains a durable local copy, and supports Undo and reload', () => {
  const { root, scope, storage } = fixture(), before = root.getDraft();
  const canvases = root.listWorkbenches().map(item => root.readWorkbench(item.id));
  const prepared = preparePublishedReception(scope, publication());
  assert.deepEqual(root.getDraft(), before, 'preview performs no write');
  assert.equal(restorePreparedReception(scope, prepared, storage), null);
  assert.equal(scope.getReception().shapes[0].color, '#cc2222');
  assert.deepEqual(canvasPart(root.getDraft()), canvasPart(before));
  const after = root.listWorkbenches().map(item => root.readWorkbench(item.id));
  after.forEach((entry, index) => assert.deepEqual(canvasPart(entry.draft), canvasPart(canvases[index].draft)));
  assert.deepEqual(readReceptionRecovery(storage, profile).value.reception, before.reception);
  assert.ok(scope.undo()); assert.deepEqual(root.getDraft(), before);
  assert.ok(scope.redo()); assert.equal(scope.getReception().shapes[0].color, '#cc2222');
  scope.release();
  const reopened = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  const editing = createReceptionEditorScope(reopened);
  assert.equal(editing.getReception().shapes[0].color, '#cc2222');
  restorePreparedReception(editing, preparePreviousReception(editing, storage), storage);
  assert.deepEqual(editing.getReception(), before.reception);
  assert.equal(readReceptionRecovery(storage, profile).value.reception.shapes[0].color, '#cc2222');
});

test('another profile, stale publication, invalid document and unavailable publication cannot be imported', () => {
  const { scope, root, storage } = fixture(), before = root.getDraft();
  assert.throws(() => preparePublishedReception(scope, publication(other)), /another profile/);
  for (const status of ['STALE', 'LOADING', 'INVALID', 'ERROR'])
    assert.throws(() => preparePublishedReception(scope, { ...publication(), status }), /unavailable/);
  assert.throws(() => preparePublishedReception(scope, { status: 'RESOLVED', document: {} }));
  assert.deepEqual(root.getDraft(), before);
  assert.equal(readReceptionRecovery(storage, profile).status, 'absent');
});

test('stale previews and released scopes cannot back up or replace a newer draft', () => {
  const { scope, root, storage } = fixture(), prepared = preparePublishedReception(scope, publication());
  addShape(scope, profile, { position: { left: 500, top: 100 }, size: { width: 100, height: 100 } });
  const before = root.getDraft();
  assert.throws(() => restorePreparedReception(scope, prepared, storage), /changed/);
  assert.deepEqual(root.getDraft(), before);
  assert.equal(readReceptionRecovery(storage, profile).status, 'absent');
  scope.release();
  assert.throws(() => restorePreparedReception(scope, prepared, storage), /Reopen/);
});

test('a failed backup or canonical save leaves the active Reception intact', () => {
  for (const target of ['backup', 'draft']) {
    const { scope, root, storage, fail } = fixture(), prepared = preparePublishedReception(scope, publication()), before = root.getDraft();
    fail(target === 'backup' ? receptionRecoveryKey(profile) : systemWorkflowDraftKey(profile));
    assert.throws(() => restorePreparedReception(scope, prepared, storage), target === 'backup' ? /backed up/ : /could not be saved/);
    assert.deepEqual(root.getDraft(), before);
    fail(null);
    if (target === 'draft') assert.deepEqual(readReceptionRecovery(storage, profile).value.reception, before.reception);
  }
});

test('transition guards and malformed recovery copies cannot replace current work', () => {
  const { scope, root, storage, records } = fixture(), before = root.getDraft();
  const remove = scope.guardWorkbenchTransition(() => 'Save pending edits first.');
  assert.throws(() => preparePublishedReception(scope, publication()), /pending edits/);
  remove();
  records.set(receptionRecoveryKey(profile), '{broken');
  assert.equal(readReceptionRecovery(storage, profile).status, 'unavailable');
  assert.throws(() => preparePreviousReception(scope, storage));
  assert.deepEqual(root.getDraft(), before);
});
