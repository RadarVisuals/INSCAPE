import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from './systemWorkflowDraftStore.js';
import { FIRST_WORKBENCH_ID, projectWorkbenchDraft } from './domain/workbenchCollection.js';
import { addTextModule, saveTextModuleResult } from '../text/textSession.js';

const profile = `0x${'c'.repeat(40)}`;
const key = systemWorkflowDraftKey(profile);

function fixture() {
  const records = new Map();
  const faults = { read: false, write: false };
  const storage = {
    getItem(name) { if (faults.read) throw Error('read denied'); return records.get(name) ?? null; },
    setItem(name, value) { if (faults.write) throw Error('QuotaExceededError'); records.set(name, value); },
  };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  addTextModule(root, profile);
  assert.equal(root.createWorkbench('Second', { generateId: () => 'second' }), 'workbench:second');
  addTextModule(root, profile);
  const draft = root.getDraft();
  draft.texts[0].article.title = 'Accepted title';
  assert.equal(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration(), historyLabel: 'Accepted title' }), true);
  return { root, scope: root.getWorkbenchScope(), records, storage, faults };
}

const actions = {
  content: {
    run(scope) {
      const text = scope.getDraft().texts[0];
      return saveTextModuleResult(scope, profile, text, { ...text, article: { ...text.article, title: 'Next title' } }).saved;
    },
  },
  shared: {
    run(scope) {
      const draft = scope.getDraft(); draft.identityPresentation.alias = 'Shared profile';
      return scope.commitCompletedOperation(draft, { expectedGeneration: scope.getGeneration() });
    },
  },
  create: { changesContext: true, run: scope => scope.createWorkbench('Third', { generateId: () => 'third' }) },
  switch: { changesContext: true, run: scope => scope.switchWorkbench(FIRST_WORKBENCH_ID) },
  rename: { run: scope => scope.renameWorkbench('Renamed') },
  restore: {
    changesContext: true,
    run(scope) {
      const backup = scope.getBackupSnapshot();
      backup.activeId = FIRST_WORKBENCH_ID;
      backup.shared.identityPresentation.alias = 'Restored profile';
      return scope.restoreBackup(backup, { expectedGeneration: scope.getGeneration() });
    },
  },
  undo: { run: scope => scope.undo() },
  redo: { prepare: scope => assert.equal(scope.undo(), true), run: scope => scope.redo() },
};

function acceptedState(root) {
  return {
    draft: root.getDraft(), collection: root.getBackupSnapshot(), history: root.getHistory(),
    generation: root.getGeneration(), activation: root.getActivation(), record: root.getRecordState(),
  };
}

test('save boundary publishes collection and active scope only after one successful write', async t => {
  for (const [name, action] of Object.entries(actions)) await t.test(name, () => {
    const { root, scope, records, storage } = fixture();
    action.prepare?.(scope);
    const before = acceptedState(root), snapshot = root.getSnapshot();
    let writes = 0, rootNotifications = 0, scopeNotifications = 0;
    const setItem = storage.setItem;
    storage.setItem = (recordKey, raw) => {
      writes++;
      assert.equal(root.getSnapshot(), snapshot, 'accepted content must not advance before storage succeeds');
      assert.equal(scope.getSnapshot(), snapshot);
      assert.equal(root.getGeneration(), before.generation);
      assert.equal(root.getActivation(), before.activation);
      assert.equal(scope.isCurrent(), true);
      assert.equal(rootNotifications, 0);
      setItem(recordKey, raw);
    };
    root.subscribe(() => {
      rootNotifications++;
      assert.equal(writes, 1);
      assert.deepEqual(root.getBackupSnapshot(), JSON.parse(records.get(key)), 'observers see the saved collection');
      assert.deepEqual(root.getDraft(), projectWorkbenchDraft(JSON.parse(records.get(key))));
      assert.equal(root.getGeneration(), before.generation + 1);
      assert.equal(scope.isCurrent(), !action.changesContext, 'departure is revoked before arrival is announced');
      if (name === 'undo') assert.equal(root.getHistory().redo, 'Accepted title');
      if (name === 'redo') assert.equal(root.getHistory().undo, 'Accepted title');
      if (name === 'restore') assert.deepEqual(root.getHistory(), { undo: null, redo: null });
    });
    scope.subscribe(() => { scopeNotifications++; assert.deepEqual(scope.getSnapshot(), root.getSnapshot()); });
    assert.ok(action.run(scope));
    assert.equal(writes, 1); assert.equal(rootNotifications, 1);
    assert.equal(scopeNotifications, action.changesContext ? 0 : 1);
    assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getBackupSnapshot(), root.getBackupSnapshot());
  });
});

test('save boundary rejects storage faults without accepting content, history or context', async t => {
  for (const [name, action] of Object.entries(actions)) {
    for (const [fault, reason] of Object.entries({ read: 'read_failed', quota: 'write_failed', external: 'changed', missingWriter: 'write_failed' })) {
      await t.test(`${name}: ${fault}`, () => {
        const { root, scope, records, storage, faults } = fixture();
        action.prepare?.(scope);
        const before = acceptedState(root), snapshot = root.getSnapshot();
        let notifications = 0, writes = 0;
        root.subscribe(() => notifications++); scope.subscribe(() => notifications++);
        const setItem = storage.setItem;
        storage.setItem = (...args) => { writes++; return setItem(...args); };
        if (fault === 'read') faults.read = true;
        if (fault === 'quota') faults.write = true;
        if (fault === 'missingWriter') delete storage.setItem;
        if (fault === 'external') {
          const external = root.getBackupSnapshot(); external.shared.identityPresentation.alias = 'Changed elsewhere';
          records.set(key, JSON.stringify(external));
        }
        const stored = records.get(key);
        assert.equal(action.run(scope), false);
        assert.deepEqual(acceptedState(root), before, 'failed operations retain all accepted state');
        assert.equal(root.getSnapshot(), snapshot); assert.equal(scope.getSnapshot(), snapshot);
        assert.equal(scope.isCurrent(), true); assert.equal(records.get(key), stored);
        assert.equal(notifications, 0, 'failed operations do not announce acceptance');
        assert.equal(writes, fault === 'quota' ? 1 : 0);
        assert.equal(root.getLastCommitFailure(), reason, 'the failure identifies its actual recovery cause');
      });
    }
  }
});

test('save boundary retry retains old acceptance until recovery saves and undoes only its new edit', () => {
  const { root, scope, records, storage, faults } = fixture();
  const external = root.getBackupSnapshot();
  external.shared.identityPresentation.alias = 'External shared change';
  external.workbenches[0].content.texts[0].article.title = 'External inactive change';
  external.workbenches[1].content.texts[0].article.title = 'External active change';
  records.set(key, JSON.stringify(external));
  const before = acceptedState(root), snapshot = root.getSnapshot();
  let calls = 0, notifications = 0;
  root.subscribe(() => notifications++);
  const candidate = draft => { calls++; draft.texts[0].article.title = 'Recovered edit'; return draft; };
  const options = { expectedGeneration: scope.getGeneration(), historyLabel: 'Recovered Text' };
  const unchanged = () => {
    assert.deepEqual(acceptedState(root), before); assert.equal(root.getSnapshot(), snapshot);
    assert.equal(scope.getSnapshot(), snapshot); assert.equal(notifications, 0);
  };
  faults.read = true;
  assert.equal(scope.retryCompletedOperation(candidate, options), false);
  assert.equal(root.getLastCommitFailure(), 'read_failed'); assert.equal(calls, 0); unchanged();
  faults.read = false; faults.write = true;
  assert.equal(scope.retryCompletedOperation(candidate, options), false);
  assert.equal(root.getLastCommitFailure(), 'write_failed'); assert.equal(calls, 1); unchanged();
  assert.deepEqual(JSON.parse(records.get(key)), external);
  faults.write = false;
  assert.equal(scope.retryCompletedOperation(draft => {
    external.shared.identityPresentation.alias = 'Changed again during retry';
    records.set(key, JSON.stringify(external));
    return candidate(draft);
  }, options), false);
  assert.equal(root.getLastCommitFailure(), 'changed'); assert.equal(calls, 2); unchanged();
  assert.equal(scope.retryCompletedOperation(candidate, options), true);
  assert.equal(calls, 3); assert.equal(notifications, 1);
  assert.equal(root.getGeneration(), before.generation + 1);
  assert.equal(root.getActivation(), before.activation);
  assert.equal(root.getDraft().identityPresentation.alias, 'Changed again during retry');
  assert.equal(root.getBackupSnapshot().workbenches[0].content.texts[0].article.title, 'External inactive change');
  assert.deepEqual(root.getHistory(), { undo: 'Recovered Text', redo: null });
  assert.equal(scope.undo(), true);
  assert.equal(root.getDraft().texts[0].article.title, 'External active change');
  assert.equal(scope.undo(), false, 'old local history is discarded only after confirmed recovery');
  assert.equal(scope.redo(), true);
  assert.equal(root.getDraft().texts[0].article.title, 'Recovered edit');
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getBackupSnapshot(), root.getBackupSnapshot());
});
