import test from 'node:test';
import assert from 'node:assert/strict';
import { createNamedWorkbenchActions } from './namedWorkbenchActions.js';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { MAX_WORKBENCHES } from '../../systemWorkflow/domain/workbenchCollection.js';
import { addTextModule } from '../../text/textSession.js';
import { createDefaultWorkbenchPresentation, createTextPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { retainTextRecovery, clearTextRecovery, textRecoveryScope } from '../../text/textEditRecovery.js';

const profile = `0x${'a'.repeat(40)}`;
test('overview departure saves the live layout and revokes the canvas even when reopening the same Workbench', () => {
  const { root, store, actions, projection, faults, raw } = fixture();
  const before = raw(), activation = root.getActivation();
  faults.write = true;
  assert.throws(() => actions.leave(), /Could not save/);
  assert.equal(store.isCurrent(), true); assert.equal(raw(), before);
  faults.write = false;
  const release = store.guardWorkbenchTransition(() => 'Finish the gesture');
  assert.throws(() => actions.leave(), /Finish the gesture/); release();
  actions.leave();
  assert.deepEqual(root.readWorkbench(root.getWorkbenchId()).draft.workbench, projection.value);
  assert.equal(root.getActivation(), activation + 1);
  assert.equal(store.isCurrent(), false);
  root.switchWorkbench(root.getWorkbenchId());
  assert.notEqual(root.getWorkbenchScope(), store);
  assert.throws(() => actions.leave(), /cannot save/);
});
function fixture() {
  const records = new Map(), faults = { write: false, read: false };
  const storage = {
    getItem(key) { if (faults.read) throw Error('unavailable'); return records.get(key) ?? null; },
    setItem(key, value) { if (faults.write) throw Error('full'); records.set(key, value); },
  };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  addTextModule(root, profile);
  const draft = root.getDraft();
  draft.workbench = createDefaultWorkbenchPresentation();
  draft.workbench.texts = [createTextPresentation(draft.texts[0].id, 0)];
  assert.ok(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() }));
  const store = root.getWorkbenchScope();
  const projection = { value: store.getDraft().workbench, error: null };
  projection.value.texts[0].window.left += 123;
  let flushes = 0;
  const options = { store, projection, flushLayout: () => { flushes++; return true; } };
  return { root, store, records, storage, faults, projection,
    actions: createNamedWorkbenchActions(options),
    actionsWith: overrides => createNamedWorkbenchActions({ ...options, ...overrides }),
    flushes: () => flushes,
    raw: () => records.get(systemWorkflowDraftKey(profile)),
  };
}

test('renaming saves the visible layout and name together, including backup and reopening', () => {
  const { root, store, actions, storage, projection } = fixture();
  const history = store.getHistory(), activation = root.getActivation();
  actions.rename('  Lunar Desert  ');
  const reopened = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.equal(reopened.listWorkbenches()[0].name, 'Lunar Desert');
  assert.deepEqual(reopened.getDraft().workbench, projection.value);
  assert.deepEqual(store.getBackupSnapshot().workbenches[0].content.workbench, projection.value);
  assert.equal(root.getActivation(), activation, 'renaming does not remount the canvas');
  assert.deepEqual(store.getHistory(), history, 'renaming does not replace content Undo');
});

test('failed rename preserves name, layout and history, and retry commits both', () => {
  const { store, actions, faults, raw, projection } = fixture();
  const before = raw(), history = store.getHistory();
  faults.write = true;
  assert.throws(() => actions.rename('Lunar Desert'), /Could not save/);
  assert.equal(raw(), before);
  assert.deepEqual(store.getHistory(), history);
  faults.write = false;
  actions.rename('Lunar Desert');
  assert.equal(store.listWorkbenches()[0].name, 'Lunar Desert');
  assert.deepEqual(store.getDraft().workbench, projection.value);
});

test('creation captures the departing canvas and delayed actions cannot touch its replacement', () => {
  const { root, store, actions, raw, flushes, projection } = fixture();
  const first = store.getWorkbenchId();
  actions.create('Studies');
  const accepted = raw(), count = flushes();
  assert.notEqual(root.getWorkbenchId(), first);
  assert.equal(root.getDraft().texts, undefined);
  assert.deepEqual(JSON.parse(accepted).workbenches[0].content.workbench, projection.value);
  assert.throws(() => actions.rename('Late rename'), /cannot save/);
  assert.throws(() => actions.switchTo(root.getWorkbenchId()), /cannot save/);
  assert.equal(raw(), accepted);
  assert.equal(flushes(), count, 'obsolete commands cannot flush an old layout cache');
});

test('invalid names and the collection limit preserve saved content', () => {
  const { root, actions, actionsWith, raw } = fixture();
  const before = raw();
  for (const name of ['   ', 'a'.repeat(65), 'bad\u0000name']) {
    assert.throws(() => actions.create(name), /1–64/);
    assert.throws(() => actions.rename(name), /1–64/);
  }
  assert.equal(raw(), before);
  for (let index = 1; index < MAX_WORKBENCHES; index++) root.createWorkbench(`Workbench ${index + 1}`);
  const full = raw();
  assert.throws(() => actionsWith({ store: root.getWorkbenchScope(),
    projection: { value: root.getDraft().workbench } }).create('Overflow'), /up to 8/);
  assert.equal(raw(), full);
});

test('preview, invalid layout and cache failures keep the current canvas and name', () => {
  const { actionsWith, raw } = fixture();
  const before = raw();
  assert.throws(() => actionsWith({ busy: true }).create('B'), /preview/);
  assert.throws(() => actionsWith({ projection: { value: null, error: 'Invalid live layout' } }).rename('A'), /Invalid live layout/);
  assert.throws(() => actionsWith({ flushLayout: () => false }).create('B'), /layout could not be saved/);
  assert.equal(raw(), before);
});

test('pending Text and registered unfinished edits still prevent departure', () => {
  const { store, actions, raw } = fixture();
  const scope = textRecoveryScope(profile, store.getDraft().texts[0].id), before = raw();
  retainTextRecovery(store, scope, { title: 'saved' }, { title: 'unsaved' }, 'write_failed');
  assert.throws(() => actions.create('B'), /unsaved changes/);
  assert.equal(raw(), before);
  clearTextRecovery(store, scope);
  const release = store.guardWorkbenchTransition(() => 'Finish the crop.');
  assert.throws(() => actions.create('B'), /Finish the crop/);
  assert.throws(() => actions.rename('A'), /Finish the crop/);
  assert.equal(raw(), before);
  release();
  actions.create('B');
});

test('external writes and read failures have distinct recovery messages and preserve saved bytes', () => {
  const { actions, records, faults, raw } = fixture();
  const other = JSON.parse(raw()); other.identityPresentation.alias = 'External edit';
  records.set(systemWorkflowDraftKey(profile), JSON.stringify(other));
  const changed = raw();
  assert.throws(() => actions.rename('A'), /changed elsewhere/);
  assert.equal(raw(), changed);
  faults.read = true;
  assert.throws(() => actions.rename('A'), /could not be read/);
  assert.equal(raw(), changed);
});
