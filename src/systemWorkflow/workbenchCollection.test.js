import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from './systemWorkflowDraftStore.js';
import { FIRST_WORKBENCH_ID, projectWorkbenchDraft, assertValidWorkbenchCollection } from './domain/workbenchCollection.js';
import { SYSTEM_WORKFLOW_LIMITS, validateSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { createArticle } from '../text/domain/article.js';
import { addTextModule } from '../text/textSession.js';
import { addImageModule, saveImageModule } from '../imageModule/imageModuleSession.js';
import { addShape } from '../shapes/shapeSession.js';
import { addKeeperDock, saveKeeperDock } from '../keeper/keeperSession.js';
import { serializeWorkbenchBackup, parseWorkbenchBackup, restoreWorkbenchBackup } from './workbenchBackup.js';
import { loadWorkbenchLayout, saveWorkbenchLayout } from '../public/ownerSystemWorkflow/workbenchLayoutStorage.js';
import { bindWorkbenchTextRecovery, retainTextRecovery, clearTextRecovery, textRecoveries, textRecoveryScope } from '../text/textEditRecovery.js';
import { createProfileDocumentV9AssetResolver } from '../profileDocument/domain/profileDocumentV9Asset.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets } from '../public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { acquireProfileEditor } from './profileEditorLease.js';

const profile = `0x${'a'.repeat(40)}`;
function fixture() {
  const records = new Map();
  const faults = { read: false, write: false };
  const storage = {
    getItem(key) { if (faults.read) throw Error('unavailable'); return records.get(key) ?? null; },
    setItem(key, value) { if (faults.write) throw Error('quota'); records.set(key, value); },
    removeItem: key => records.delete(key),
  };
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  return { store, storage, records, faults, raw: () => records.get(systemWorkflowDraftKey(profile)) };
}
function edit(store, change) {
  const draft = store.getDraft(); change(draft);
  assert.equal(store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() }), true);
}

test('active saves stay detached and atomic across invalid edits, failed writes and Undo', () => {
  const { store, raw, faults, storage } = fixture();
  addTextModule(store, profile);
  const other = store.createWorkbench('Other');
  addTextModule(store, profile);
  edit(store, draft => { draft.texts[0].article.title = 'Inactive content'; });
  store.switchWorkbench(FIRST_WORKBENCH_ID);
  const inactive = JSON.parse(raw()).workbenches.find(item => item.id === other);
  const draft = store.getDraft(), before = raw(), generation = store.getGeneration(), history = store.getHistory();
  draft.texts[0].article.title = 'Accepted active edit';
  faults.write = true;
  assert.equal(store.commitCompletedOperation(draft, { expectedGeneration: generation }), false);
  assert.equal(raw(), before); assert.equal(store.getGeneration(), generation);
  assert.deepEqual(store.getHistory(), history);
  faults.write = false;
  assert.ok(store.commitCompletedOperation(draft, { expectedGeneration: generation }));
  draft.texts[0].article.title = 'Mutated caller input';
  assert.equal(store.getSnapshot().texts[0].article.title, 'Accepted active edit');
  const accepted = raw(), invalid = store.getDraft();
  invalid.texts[0].article.content = { type: 'not-a-document' };
  assert.equal(store.commitCompletedOperation(invalid, { expectedGeneration: store.getGeneration() }), false);
  assert.equal(raw(), accepted);
  assert.ok(store.undo()); assert.ok(store.redo());
  const collection = JSON.parse(raw());
  assert.deepEqual(collection.workbenches.find(item => item.id === other), inactive);
  assert.doesNotThrow(() => assertValidWorkbenchCollection(collection));
  const reopened = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.equal(reopened.getSnapshot().texts[0].article.title, 'Accepted active edit');
});

test('shared changes still validate the byte limit of an inactive full Workbench', () => {
  const { store, raw } = fixture();
  const full = store.getDraft(); full.grids = [];
  full.texts = Array.from({ length: 3 }, (_, i) => ({
    id: 'text:large-' + i, visibility: 'PRIVATE', article: createArticle('Article ' + i),
  }));
  for (const text of full.texts) text.article.content.content = [{
    type: 'paragraph', content: [{ type: 'text', text: 'a'.repeat(170000) }],
  }];
  const remaining = SYSTEM_WORKFLOW_LIMITS.maxJsonBytes - 32 - new TextEncoder().encode(JSON.stringify(full)).length;
  assert.ok(remaining > 0 && remaining < 20000);
  full.texts[0].article.content.content[0].content[0].text += 'a'.repeat(remaining);
  assert.ok(store.commitCompletedOperation(full, { expectedGeneration: store.getGeneration() }));
  const smallId = store.createWorkbench('Small');
  addTextModule(store, profile);
  edit(store, draft => { draft.texts[0].article.title = 'Small edit beside full canvas'; });
  const candidate = store.getDraft(), before = raw();
  candidate.identityPresentation.bio = { mode: 'inscape', customText: 'Shared biography. '.repeat(20) };
  assert.equal(validateSystemWorkflowDraft(candidate).valid, true, 'the shared change fits the active canvas');
  assert.equal(store.commitCompletedOperation(candidate, { expectedGeneration: store.getGeneration() }), false,
    'a small active canvas cannot enlarge shared data beyond an inactive canvas limit');
  assert.equal(raw(), before); assert.equal(store.getWorkbenchId(), smallId);
  assert.equal(store.getLastCommitFailure(), 'invalid');
});

test('incremental saves reject external edits and retry only against a fully validated collection', () => {
  const { store, raw, storage } = fixture();
  addTextModule(store, profile); store.createWorkbench('B'); addTextModule(store, profile);
  const generation = store.getGeneration(), candidate = store.getDraft();
  candidate.texts[0].article.title = 'My edit';
  const external = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  edit(external, draft => { draft.identityPresentation.alias = 'Another edit'; });
  const externalRaw = raw();
  assert.equal(store.commitCompletedOperation(candidate, { expectedGeneration: generation }), false);
  assert.equal(raw(), externalRaw);
  assert.ok(store.retryCompletedOperation(draft => {
    draft.texts[0].article.title = 'Rebased edit'; return draft;
  }, { expectedGeneration: generation }));
  assert.equal(store.getSnapshot().identityPresentation.alias, 'Another edit');
  const corrupt = JSON.parse(raw()); corrupt.workbenches[0].content.texts = 'broken';
  storage.setItem(systemWorkflowDraftKey(profile), JSON.stringify(corrupt));
  const corruptRaw = raw();
  assert.equal(store.retryCompletedOperation(draft => draft, { expectedGeneration: store.getGeneration() }), false);
  assert.equal(raw(), corruptRaw); assert.equal(store.getLastCommitFailure(), 'corrupt');
});

test('two named Workbenches retain separate modules, dimensions, layout and edits through switching and reload', () => {
  const { store, storage } = fixture();
  addTextModule(store, profile); addImageModule(store, profile); addShape(store, profile); addKeeperDock(store, profile);
  edit(store, draft => {
    draft.texts[0].article.title = 'Lunar article';
    draft.imageModules[0].name = 'Lunar image';
    draft.workbench.area = { width: 1200, height: 900 };
  });
  assert.ok(store.renameWorkbench('Lunar Desert'));
  const a = store.getDraft();
  const bId = store.createWorkbench('Studies');
  assert.ok(bId); assert.notEqual(bId, FIRST_WORKBENCH_ID);
  assert.equal(store.getDraft().texts, undefined);
  assert.equal(store.getDraft().imageModules, undefined);
  assert.equal(store.getDraft().shapes, undefined);
  assert.deepEqual(store.getDraft().grids, [], 'new Workbenches never create Display');
  assert.deepEqual(store.getDraft().keeperDocks, a.keeperDocks, 'one shared Keeper configuration');
  addTextModule(store, profile); addImageModule(store, profile); addShape(store, profile);
  edit(store, draft => { draft.texts[0].article.title = 'Studies article'; draft.workbench.area = { width: 640, height: 480 }; });
  const b = store.getDraft();
  assert.ok(store.switchWorkbench(FIRST_WORKBENCH_ID));
  assert.deepEqual(store.getDraft(), a);
  assert.ok(store.switchWorkbench(bId));
  assert.deepEqual(store.getDraft(), b);
  const reopened = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.equal(reopened.getWorkbenchId(), bId);
  assert.deepEqual(reopened.getDraft(), b);
  assert.ok(reopened.switchWorkbench(FIRST_WORKBENCH_ID));
  assert.deepEqual(reopened.getDraft(), a);
  assert.deepEqual(reopened.listWorkbenches().map(item => item.name), ['Lunar Desert', 'Studies']);
});

test('Undo and redo belong to the originating Workbench; switching is not a history entry', () => {
  const { store } = fixture();
  addTextModule(store, profile);
  store.reload(); // Start a deliberate history, excluding setup.
  edit(store, draft => { draft.texts[0].article.title = 'A changed'; });
  const aHistory = store.getHistory();
  const b = store.createWorkbench('B');
  assert.deepEqual(store.getHistory(), { undo: null, redo: null });
  addShape(store, profile);
  assert.ok(store.switchWorkbench(FIRST_WORKBENCH_ID));
  assert.deepEqual(store.getHistory(), aHistory);
  assert.ok(store.undo());
  assert.notEqual(store.getDraft().texts[0].article.title, 'A changed');
  assert.ok(store.redo()); assert.equal(store.getDraft().texts[0].article.title, 'A changed');
  assert.ok(store.switchWorkbench(b));
  assert.equal(store.getDraft().shapes.length, 1);
  assert.ok(store.undo()); assert.equal(store.getDraft().shapes, undefined);
  assert.ok(store.switchWorkbench(FIRST_WORKBENCH_ID));
  assert.equal(store.getDraft().texts[0].article.title, 'A changed');
});

test('using the same Library source never shares mutable Image crop, sides or dimensions', () => {
  const { store, storage } = fixture();
  const asset = createProfileDocumentV9AssetResolver(assets, { compactContentReference: false })(assets[0].id);
  const side = { id: 'side:source', asset, crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } };
  addImageModule(store, profile);
  edit(store, draft => { draft.imageModules[0].sides = [side]; });
  const a = store.getDraft().imageModules[0];
  const bId = store.createWorkbench('Same source, different use');
  addImageModule(store, profile);
  edit(store, draft => { draft.imageModules[0].sides = [side]; });
  edit(store, draft => {
    draft.imageModules[0].width = 800;
    draft.imageModules[0].sides[0].crop = { x: .2, y: .8, zoom: 2 };
    draft.imageModules[0].sides.push({ ...side, id: 'side:extra' });
  });
  const b = store.getDraft().imageModules[0];
  assert.notEqual(a.id, b.id);
  assert.equal(a.sides[0].asset.stableAssetId, b.sides[0].asset.stableAssetId);
  const reopened = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.equal(reopened.getWorkbenchId(), bId);
  assert.deepEqual(reopened.getDraft().imageModules[0], b);
  assert.ok(reopened.switchWorkbench(FIRST_WORKBENCH_ID));
  assert.deepEqual(reopened.getDraft().imageModules[0], a);
});

test('an unfinished edit blocks switching without writes and its guard is released after completion', () => {
  const { store, raw } = fixture();
  store.renameWorkbench('A');
  let editing = true;
  const release = store.getWorkbenchScope().guardWorkbenchTransition(() => editing ? 'Finish crop' : null);
  const before = raw();
  assert.throws(() => store.createWorkbench('B'), /Finish crop/);
  assert.equal(raw(), before);
  editing = false;
  assert.ok(store.createWorkbench('B'));
  release();
  assert.ok(store.switchWorkbench(FIRST_WORKBENCH_ID));
});

test('a disposed Workbench handle cannot write, retry or undo after A → B → A', () => {
  const { store, raw } = fixture();
  addImageModule(store, profile);
  const old = store.getWorkbenchScope(), expected = old.getDraft().imageModules[0];
  assert.ok(old.createWorkbench('B'));
  const beforeB = raw();
  assert.equal(saveImageModule(old, profile, expected, { ...expected, name: 'Late A' }), false);
  assert.equal(old.retryCompletedOperation(draft => draft), false);
  assert.equal(old.undo(), false);
  assert.equal(raw(), beforeB);
  assert.equal(old.getDraft().imageModules[0].id, expected.id, 'old operations still read their original target');
  assert.ok(store.switchWorkbench(FIRST_WORKBENCH_ID));
  const beforeA = raw();
  assert.equal(saveImageModule(old, profile, expected, { ...expected, name: 'Late again' }), false);
  assert.equal(raw(), beforeA);
  const live = store.getWorkbenchScope();
  assert.ok(saveImageModule(live, profile, live.getDraft().imageModules[0], { ...expected, name: 'Current A' }));
});

test('failed creation, switching and rename preserve accepted bytes, active Workbench and Undo', () => {
  const { store, faults, raw } = fixture();
  addTextModule(store, profile);
  const before = raw(), history = store.getHistory();
  faults.write = true;
  assert.equal(store.createWorkbench('B'), false);
  assert.equal(raw(), before); assert.equal(store.listWorkbenches().length, 1);
  assert.deepEqual(store.getHistory(), history);
  faults.write = false;
  const b = store.createWorkbench('B');
  const accepted = raw();
  faults.write = true;
  assert.equal(store.switchWorkbench(FIRST_WORKBENCH_ID), false);
  assert.equal(store.renameWorkbench('Failed name'), false);
  assert.equal(store.getWorkbenchId(), b); assert.equal(raw(), accepted);
  faults.write = false; faults.read = true;
  assert.equal(store.switchWorkbench(FIRST_WORKBENCH_ID), false);
  assert.equal(raw(), accepted); assert.equal(store.getWorkbenchId(), b);
});

test('corrupt or externally changed collections are never replaced with an empty Workbench', () => {
  const { store, records, storage, raw } = fixture();
  const b = store.createWorkbench('B'), accepted = store.getDraft();
  const collection = JSON.parse(raw());
  collection.workbenches[0].content.texts = 'broken';
  const invalid = JSON.stringify(collection); records.set(systemWorkflowDraftKey(profile), invalid);
  assert.equal(store.switchWorkbench(FIRST_WORKBENCH_ID), false);
  assert.equal(store.getWorkbenchId(), b); assert.deepEqual(store.getDraft(), accepted);
  const reopened = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.equal(reopened.getRecordState().status, 'corrupt');
  assert.throws(() => reopened.getDraft());
  assert.equal(raw(), invalid);
});

test('retry cannot apply an operation to a different externally selected Workbench or a replaced single draft', () => {
  const { store, records, raw } = fixture();
  addTextModule(store, profile);
  const single = raw();
  store.createWorkbench('B');
  const accepted = store.getDraft(), collection = JSON.parse(raw());
  for (const replacement of [JSON.stringify({ ...collection, activeId: FIRST_WORKBENCH_ID }), single]) {
    records.set(systemWorkflowDraftKey(profile), replacement);
    let called = false;
    assert.equal(store.retryCompletedOperation(draft => { called = true; return draft; },
      { expectedGeneration: store.getGeneration() }), false);
    assert.equal(called, false);
    assert.equal(raw(), replacement);
    assert.deepEqual(store.getDraft(), accepted);
  }
});

test('shared Keeper edits survive switching and room-style reopening without duplicating configuration', () => {
  const { store, storage, raw } = fixture();
  addKeeperDock(store, profile);
  const keeper = store.getDraft().keeperDocks[0];
  store.createWorkbench('B');
  assert.ok(saveKeeperDock(store, profile, keeper, { name: 'Shared inhabitant' }));
  assert.ok(store.switchWorkbench(FIRST_WORKBENCH_ID));
  const room = createSystemWorkflowDraftStore({ profileAddress: profile, storage, requireEditor: true });
  assert.equal(room.getDraft().keeperDocks.length, 1);
  assert.equal(room.getDraft().keeperDocks[0].name, 'Shared inhabitant');
  assert.ok(saveKeeperDock(room, profile, room.getDraft().keeperDocks[0], { size: 120 }));
  const collection = JSON.parse(raw());
  assert.equal(collection.shared.keeperDocks.length, 1);
  assert.ok(collection.workbenches.every(item => !Object.hasOwn(item.content, 'keeperDocks')));
  assert.ok(collection.workbenches.every(item => projectWorkbenchDraft(collection, item.id).keeperDocks[0].size === 120));
});

test('layout caches are composition-scoped and cannot recreate another canvas', () => {
  const { store, storage } = fixture();
  addShape(store, profile); const a = store.getDraft();
  assert.ok(saveWorkbenchLayout(profile, a, a.workbench, {}, storage, FIRST_WORKBENCH_ID));
  const b = store.createWorkbench('B'); addTextModule(store, profile);
  const draftB = store.getDraft();
  assert.deepEqual(loadWorkbenchLayout(profile, draftB, storage, b), { layout: null, views: {} });
  assert.ok(saveWorkbenchLayout(profile, draftB, draftB.workbench, {}, storage, b));
  assert.deepEqual(loadWorkbenchLayout(profile, a, storage, FIRST_WORKBENCH_ID).layout, a.workbench);
  assert.deepEqual(loadWorkbenchLayout(profile, draftB, storage, b).layout, draftB.workbench);
});

test('all-Workbench backups roundtrip both compositions and reject partial replacement', () => {
  const source = fixture();
  addTextModule(source.store, profile);
  const single = parseWorkbenchBackup(serializeWorkbenchBackup(source.store.getDraft()), profile);
  source.store.createWorkbench('B'); addShape(source.store, profile); addKeeperDock(source.store, profile);
  const backup = parseWorkbenchBackup(serializeWorkbenchBackup(source.store.getBackupSnapshot()), profile);
  assert.equal(backup.version, 2);
  const target = fixture();
  assert.ok(restoreWorkbenchBackup(target.store, backup, { expectedGeneration: target.store.getGeneration() }, target.storage).saved);
  assert.deepEqual(target.store.getBackupSnapshot(), source.store.getBackupSnapshot());
  const before = target.raw();
  assert.equal(restoreWorkbenchBackup(target.store, single, { expectedGeneration: target.store.getGeneration() }, target.storage).saved, false);
  assert.equal(target.raw(), before);
  const removeGuard = target.store.guardWorkbenchTransition(() => 'Finish the crop first.');
  assert.deepEqual(restoreWorkbenchBackup(target.store, backup,
    { expectedGeneration: target.store.getGeneration() }, target.storage),
  { saved: false, error: 'Finish the crop first.' });
  assert.equal(target.raw(), before);
  removeGuard();
  const invalid = structuredClone(backup.draft);
  invalid.workbenches[1].content.keeperDocks = [];
  assert.throws(() => assertValidWorkbenchCollection(invalid));
});

test('failed Text recovery is isolated even when two compositions have matching module IDs', () => {
  const { store } = fixture();
  const a = store.getWorkbenchScope(); bindWorkbenchTextRecovery(a);
  const scope = textRecoveryScope(profile, 'text:same');
  retainTextRecovery(a, scope, { title: 'saved' }, { title: 'unsaved' }, 'write_failed');
  assert.throws(() => store.createWorkbench('B'), /unsaved changes/);
  clearTextRecovery(a, scope);
  store.createWorkbench('B');
  retainTextRecovery(a, scope, { title: 'saved' }, { title: 'unsaved' }, 'write_failed');
  const b = store.getWorkbenchScope(); bindWorkbenchTextRecovery(b);
  assert.equal(textRecoveries(b, profile).length, 0);
  assert.equal(textRecoveries(a, profile).length, 1);
  clearTextRecovery(a, scope);
});

test('a Workbench scope exposes only its explicit editing contract, never root lifecycle or scope acquisition', () => {
  const { store } = fixture();
  const scope = store.getWorkbenchScope();
  assert.deepEqual(Object.keys(scope).sort(), [
    'hasWriteAccess', 'isCurrent', 'getProfileAddress', 'getWorkbenchId', 'getSnapshot', 'getDraft',
    'getGeneration', 'getHistory', 'getRecordState', 'getLastCommitFailure', 'isCollection',
    'listWorkbenches', 'getBackupSnapshot', 'subscribe', 'guardWorkbenchTransition',
    'beginHistoryGroup', 'endHistoryGroup', 'undo', 'redo', 'commitCompletedOperation',
    'retryCompletedOperation', 'restoreBackup', 'createWorkbench', 'switchWorkbench', 'renameWorkbench',
  ].sort());
  assert.ok(Object.isFrozen(scope));
  assert.equal(store.getWorkbenchScope(), scope);
  for (const name of ['reload', 'setProfileAddress', 'resetCorruptDraft', 'getActivation', 'getWorkbenchScope']) {
    assert.equal(typeof store[name], 'function', `${name} remains root-owned`);
    assert.equal(scope[name], undefined, `${name} cannot escape the originating activation`);
  }
});

test('current scopes preserve edits, retry, grouped history, transitions and backup recovery', () => {
  const { store, storage, raw } = fixture();
  let scope = store.getWorkbenchScope();
  let notifications = 0;
  const stop = scope.subscribe(() => notifications++);
  scope.beginHistoryGroup();
  edit(scope, draft => { draft.identityPresentation.alias = 'First'; });
  edit(scope, draft => { draft.identityPresentation.alias = 'Grouped'; });
  scope.endHistoryGroup();
  edit(scope, draft => { draft.identityPresentation.alias = 'Separate'; });
  assert.ok(scope.undo()); assert.equal(scope.getDraft().identityPresentation.alias, 'Grouped');
  assert.ok(scope.undo()); assert.equal(scope.getDraft().identityPresentation.alias, '');
  assert.ok(scope.redo()); assert.equal(scope.getDraft().identityPresentation.alias, 'Grouped');
  assert.ok(scope.redo()); assert.equal(scope.getDraft().identityPresentation.alias, 'Separate');
  const external = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  edit(external, draft => { draft.identityPresentation.alias = 'External'; });
  let retries = 0;
  assert.ok(scope.retryCompletedOperation(draft => {
    retries++; assert.equal(draft.identityPresentation.alias, 'External');
    draft.identityPresentation.alias = 'Rebased'; return draft;
  }, { expectedGeneration: scope.getGeneration() }));
  assert.equal(retries, 1); assert.equal(JSON.parse(raw()).identityPresentation.alias, 'Rebased');
  assert.ok(scope.renameWorkbench('A'));
  const retained = scope.getSnapshot(), count = notifications;
  const b = scope.createWorkbench('B'); assert.ok(b);
  assert.equal(notifications, count, 'departing scope does not observe arriving activation');
  assert.equal(scope.getSnapshot(), retained);
  assert.deepEqual(scope.getDraft(), retained);
  assert.equal(scope.getProfileAddress(), profile);
  assert.equal(scope.getWorkbenchId(), FIRST_WORKBENCH_ID);
  scope = store.getWorkbenchScope();
  const release = scope.guardWorkbenchTransition(() => 'Finish the gesture');
  assert.throws(() => scope.switchWorkbench(FIRST_WORKBENCH_ID), /Finish the gesture/);
  release(); assert.ok(scope.switchWorkbench(FIRST_WORKBENCH_ID));
  scope = store.getWorkbenchScope();
  const backup = scope.getBackupSnapshot();
  edit(scope, draft => { draft.identityPresentation.alias = 'Before restore'; });
  assert.ok(scope.restoreBackup(backup, { expectedGeneration: scope.getGeneration() }));
  assert.deepEqual(store.getBackupSnapshot(), backup);
  assert.equal(scope.isCurrent(), false, 'collection restore revokes its departing scope');
  stop();
});

const scopedWrites = {
  beginHistoryGroup: scope => scope.beginHistoryGroup(),
  endHistoryGroup: scope => scope.endHistoryGroup(),
  undo: scope => scope.undo(),
  redo: scope => scope.redo(),
  commitCompletedOperation: (scope, live) => {
    const draft = live.getDraft(); draft.identityPresentation.alias = 'Late commit';
    return scope.commitCompletedOperation(draft, { expectedGeneration: live.getGeneration() });
  },
  retryCompletedOperation: (scope, live, called) => scope.retryCompletedOperation(draft => {
    called(); draft.identityPresentation.alias = 'Late retry'; return draft;
  }, { expectedGeneration: live.getGeneration() }),
  restoreBackup: (scope, live) => scope.restoreBackup(live.getBackupSnapshot(), { expectedGeneration: live.getGeneration() }),
  createWorkbench: scope => scope.createWorkbench('Late Workbench'),
  switchWorkbench: (scope, live) => scope.switchWorkbench(live.listWorkbenches().find(item => item.id !== live.getWorkbenchId()).id),
  renameWorkbench: scope => scope.renameWorkbench('Late rename'),
};

for (const departure of ['A to B', 'A to B to A', 'profile A to B', 'profile A to B to A', 'reload', 'editor release', 'editor reacquired']) {
  test(`every scoped writer and late registration rejects ${departure}`, async t => {
    for (const [name, invoke] of Object.entries(scopedWrites)) await t.test(name, async () => {
      const f = fixture(), previousWindow = globalThis.window;
      let lease, replacement;
      try {
        if (departure.startsWith('editor')) {
          globalThis.window = { localStorage: f.storage };
          const locks = { request: async (_name, _options, callback) => callback({}) };
          lease = acquireProfileEditor(profile, locks); assert.equal(await lease.ready, 'editing');
          f.store = createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage, requireEditor: true });
        }
        const root = f.store;
        root.renameWorkbench('A'); const b = root.createWorkbench('B'); root.switchWorkbench(FIRST_WORKBENCH_ID);
        const old = root.getWorkbenchScope();
        edit(old, draft => { draft.identityPresentation.alias = 'History one'; });
        edit(old, draft => { draft.identityPresentation.alias = 'History two'; });
        assert.ok(old.undo()); // Keep both Undo and Redo meaningful for rejected calls.
        const snapshot = old.getSnapshot();
        if (departure.startsWith('A to B')) {
          root.switchWorkbench(b);
          if (departure.endsWith('to A')) root.switchWorkbench(FIRST_WORKBENCH_ID);
        } else if (departure.startsWith('profile')) {
          root.setProfileAddress(`0x${'b'.repeat(40)}`);
          root.renameWorkbench('Other profile A'); root.createWorkbench('Other profile B');
          if (departure.endsWith('to A')) root.setProfileAddress(profile);
        } else if (departure === 'reload') root.reload();
        else {
          lease.stop();
          if (departure === 'editor reacquired') {
            replacement = acquireProfileEditor(profile, { request: async (_name, _options, callback) => callback({}) });
            assert.equal(await replacement.ready, 'editing');
          }
        }
        const state = () => ({ bytes: [...f.records], draft: root.getDraft(), history: root.getHistory(),
          generation: root.getGeneration(), activation: root.getActivation(), failure: root.getLastCommitFailure() });
        const before = state(); let called = 0;
        assert.equal(old.hasWriteAccess(), false);
        assert.equal(invoke(old, root, () => called++), false);
        assert.equal(called, 0, 'rejected retry never invokes user operation');
        assert.deepEqual(state(), before, 'no persisted, accepted, history or context change');
        assert.equal(old.getSnapshot(), snapshot, 'originating accepted read remains available');
        const release = old.guardWorkbenchTransition(() => { called++; return 'Late guard'; });
        assert.equal(typeof release, 'function');
        assert.equal(called, 0);
        // begin/end have no immediate persisted effect; expose an accidental
        // history-group change through the next two successful root edits.
        if (!departure.startsWith('editor')) {
          root.endHistoryGroup();
          if (name === 'beginHistoryGroup') {
            assert.equal(old.beginHistoryGroup(), false);
            edit(root, draft => { draft.identityPresentation.alias = 'Fresh one'; });
            edit(root, draft => { draft.identityPresentation.alias = 'Fresh two'; });
            assert.ok(root.undo()); assert.equal(root.getDraft().identityPresentation.alias, 'Fresh one');
          }
          if (name === 'endHistoryGroup') {
            root.beginHistoryGroup();
            edit(root, draft => { draft.identityPresentation.alias = 'Group one'; });
            assert.equal(old.endHistoryGroup(), false);
            edit(root, draft => { draft.identityPresentation.alias = 'Group two'; });
            root.endHistoryGroup(); assert.ok(root.undo());
            assert.equal(root.getDraft().identityPresentation.alias, before.draft.identityPresentation.alias);
          }
          assert.doesNotThrow(() => root.createWorkbench('After cancelled guard'));
        }
        release(); release(); assert.equal(called, 0, 'a late guard cannot block the arriving editor');
      } finally {
        replacement?.stop(); lease?.stop();
        if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
      }
    });
  });
}

test('callbacks queued before departure retain their old scope and cannot mutate the arriving Workbench', async () => {
  const { store, raw } = fixture();
  addImageModule(store, profile);
  const scope = store.getWorkbenchScope(), image = scope.getDraft().imageModules[0];
  let retries = 0, notifications = 0;
  const stop = scope.subscribe(() => notifications++);
  const late = Promise.resolve().then(() => [
    saveImageModule(scope, profile, image, { ...image, name: 'Late image' }),
    scope.retryCompletedOperation(draft => { retries++; return draft; }, { expectedGeneration: store.getGeneration() }),
    scope.undo(), scope.createWorkbench('Late canvas'),
  ]);
  assert.ok(scope.createWorkbench('B'));
  const accepted = raw();
  assert.deepEqual(await late, [false, false, false, false]);
  assert.equal(raw(), accepted); assert.equal(retries, 0); assert.equal(notifications, 0);
  stop();
});
