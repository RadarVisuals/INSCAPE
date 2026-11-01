import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from './systemWorkflowDraftStore.js';
import { createEmptySystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { addTextModule } from '../text/textSession.js';
import { addImageModule } from '../imageModule/imageModuleSession.js';
import { addShape } from '../shapes/shapeSession.js';
import { parseWorkbenchBackup, serializeWorkbenchBackup, restoreWorkbenchBackup, WORKBENCH_BACKUP_LIMIT } from './workbenchBackup.js';
import { workbenchLayoutKey } from '../public/ownerSystemWorkflow/workbenchLayoutStorage.js';
import { ownerPublicationBaselineKey } from '../profileDocument/storage/ownerPublicationBaselineStorage.js';
import { retainTextRecovery, clearTextRecovery } from '../text/textEditRecovery.js';

const profile = `0x${'1'.repeat(40)}`, other = `0x${'2'.repeat(40)}`;
function setup(raw) {
  const records = new Map(raw === undefined ? [] : [[systemWorkflowDraftKey(profile), raw]]);
  let failed = false;
  const storage = { getItem: key => records.get(key) ?? null, removeItem: key => records.delete(key), setItem: (key, value) => { if (failed) throw Error('QuotaExceededError'); records.set(key, value); } };
  return { storage, records, fail: value => { failed = value; }, store: createSystemWorkflowDraftStore({ profileAddress: profile, storage }) };
}
test('private Workbench backup restores complete content and geometry into empty browser storage', () => {
  const { store } = setup();
  addTextModule(store, profile, { position: { left: 140, top: 190 } });
  addImageModule(store, profile); addShape(store, profile, { position: { left: 600, top: 240 } });
  const draft = store.getDraft(); draft.texts[0].article.title = 'Private writing';
  draft.texts[0].article.content.content[0].content = [{ type: 'text', text: 'Keep this unpublished.' }];
  assert.equal(draft.texts[0].visibility, 'PRIVATE');
  const source = serializeWorkbenchBackup(draft), backup = parseWorkbenchBackup(source, profile);
  assert.deepEqual(backup.draft, draft);
  const target = setup();
  assert.equal(target.store.restoreBackup(backup.draft, { expectedGeneration: 0 }), true);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage: target.storage }).getDraft(), draft);
  assert.deepEqual(target.store.getHistory(), { undo: null, redo: null });
  assert.deepEqual(Object.keys(JSON.parse(source)), ['type', 'version', 'createdAt', 'draft']);
});
test('backup rejects another profile, unsupported formats, unsafe content and oversized files', () => {
  const draft = createEmptySystemWorkflowDraft(profile), source = serializeWorkbenchBackup(draft), value = JSON.parse(source);
  assert.throws(() => parseWorkbenchBackup(source, other), /different Universal Profile/);
  for (const input of ['bad', '{}', 'null', JSON.stringify({ ...value, version: 2 }), JSON.stringify({ ...value, secret: 'extra' }),
    JSON.stringify({ ...value, draft: { ...draft, credentials: 'extra' } }), JSON.stringify({ ...value, createdAt: 'broken' }), ' '.repeat(WORKBENCH_BACKUP_LIMIT + 1)])
    assert.throws(() => parseWorkbenchBackup(input, profile));
});
test('failed and stale replacement leave accepted content, saved bytes and undo unchanged', () => {
  const f = setup(); addTextModule(f.store, profile);
  const before = f.store.getDraft(), raw = f.storage.getItem(systemWorkflowDraftKey(profile)), history = f.store.getHistory();
  const generation = f.store.getGeneration(), backup = createEmptySystemWorkflowDraft(profile);
  f.fail(true);
  assert.equal(f.store.restoreBackup(backup, { expectedGeneration: generation }), false);
  assert.deepEqual(f.store.getDraft(), before); assert.equal(f.storage.getItem(systemWorkflowDraftKey(profile)), raw); assert.deepEqual(f.store.getHistory(), history);
  f.fail(false);
  const external = { ...before, identityPresentation: { ...before.identityPresentation, alias: 'Changed elsewhere' } };
  f.storage.setItem(systemWorkflowDraftKey(profile), JSON.stringify(external));
  assert.equal(f.store.restoreBackup(backup, { expectedGeneration: generation }), false);
  assert.equal(f.store.getLastCommitFailure(), 'changed'); assert.deepEqual(f.store.getHistory(), history);
  f.store.reload();
  assert.equal(f.store.restoreBackup(backup, { expectedGeneration: generation }), false);
  assert.deepEqual(f.store.getDraft(), external);
});
test('corruption requires the reviewed fingerprint and can be replaced without first deleting saved bytes', () => {
  const f = setup('{corrupt'), fingerprint = f.store.getRecordState().fingerprint, draft = createEmptySystemWorkflowDraft(profile);
  assert.equal(f.store.restoreBackup(draft, { expectedGeneration: 0 }), false);
  f.fail(true);
  assert.equal(f.store.restoreBackup(draft, { expectedGeneration: 0, expectedFingerprint: fingerprint }), false);
  assert.equal(f.storage.getItem(systemWorkflowDraftKey(profile)), '{corrupt');
  f.fail(false);
  assert.equal(f.store.restoreBackup(draft, { expectedGeneration: 0, expectedFingerprint: fingerprint }), true);
  assert.deepEqual(f.store.getDraft(), draft);
});
test('restore rejects profile switches and never accepts unreadable storage as empty', () => {
  const f = setup(), draft = f.store.getDraft(); f.store.setProfileAddress(other);
  assert.equal(f.store.restoreBackup(draft, { expectedGeneration: f.store.getGeneration() }), false);
  assert.equal(f.records.size, 0);
  const unavailable = createSystemWorkflowDraftStore({ profileAddress: profile, storage: { getItem() { throw Error('blocked'); }, setItem() { assert.fail('must not write'); } } });
  assert.equal(unavailable.restoreBackup(draft, { expectedGeneration: 0 }), false);
});

test('restoration invalidates derived layout and publication state only after confirmed save, and blocks pending Text', () => {
  const f = setup(); addTextModule(f.store, profile);
  const backup = parseWorkbenchBackup(serializeWorkbenchBackup(f.store.getDraft()), profile), options = { expectedGeneration: f.store.getGeneration() };
  const keys = [workbenchLayoutKey(profile), ownerPublicationBaselineKey(profile)];
  keys.forEach(key => f.records.set(key, 'derived'));
  f.fail(true); assert.equal(restoreWorkbenchBackup(f.store, backup, options, f.storage).saved, false);
  keys.forEach(key => assert.equal(f.records.get(key), 'derived'));
  f.fail(false);
  const scope = { profile, id: f.store.getDraft().texts[0].id };
  retainTextRecovery(f.store, scope, {}, { unsaved: 'text' }, { message: 'not saved' });
  assert.equal(restoreWorkbenchBackup(f.store, backup, options, f.storage).saved, false);
  clearTextRecovery(f.store, scope);
  assert.deepEqual(restoreWorkbenchBackup(f.store, backup, options, f.storage), { saved: true, warning: null });
  keys.forEach(key => assert.equal(f.records.has(key), false));
  f.storage.removeItem = () => { throw Error('blocked'); };
  const result = restoreWorkbenchBackup(f.store, backup, { expectedGeneration: f.store.getGeneration() }, f.storage);
  assert.equal(result.saved, true); assert.match(result.warning, /draft was restored.*could not be cleared/);
});
