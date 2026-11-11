import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneSession, sceneScopeKey } from './sceneSession.js';
import { createEmptySystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { createDisplayModuleSession } from '../systemWorkflow/displayModuleSession.js';

const profileAddress = '0x' + '1'.repeat(40);
const scope = { profileAddress, canvasId: 'workbench:main', revision: 'local:1' };
function content() {
  const draft = createEmptySystemWorkflowDraft(profileAddress, { generateId: () => 'one' });
  draft.grids.push({ ...structuredClone(draft.grids[0]), id: 'grid:two', title: 'Second' });
  return draft;
}
test('two canvas sessions isolate identical module IDs, keep selection by ID through reordering, and do not mutate authored content', () => {
  const draft = content(), before = structuredClone(draft);
  const a = createSceneSession(scope, draft), b = createSceneSession({ ...scope, canvasId: 'workbench:second' }, draft);
  const control = a.controller('display:primary');
  assert.equal(control.next(), true);
  assert.equal(a.getSnapshot()['display:primary'].gridId, 'grid:two');
  assert.equal(b.getSnapshot()['display:primary'].gridId, draft.grids[0].id);
  assert.equal(control.select('grid:missing'), false);
  a.configure({ ...draft, grids: [...draft.grids].reverse() });
  assert.equal(control.getSnapshot().gridId, 'grid:two');
  // Consumers can leave and return without owning the selection lifecycle.
  const stop = a.subscribe(() => {}); stop();
  assert.equal(a.controller('display:primary'), control);
  assert.equal(control.getSnapshot().gridId, 'grid:two');
  a.configure({ ...draft, grids: draft.grids.slice(0, 1) });
  assert.equal(control.getSnapshot().gridId, draft.grids[0].id);
  assert.deepEqual(draft, before);
  assert.notEqual(a.key, b.key);
  assert.notEqual(a.key, sceneScopeKey({ ...scope, revision: 'local:2' }));
});
test('removing and recreating a Display invalidates its old controls', () => {
  const draft = content(), session = createSceneSession(scope, draft);
  const old = session.controller('display:primary');
  session.configure({ ...draft, grids: [] });
  assert.equal(old.next(), false);
  session.configure(draft);
  assert.equal(old.select('grid:two'), false);
  assert.equal(old.reconcile(draft.grids), null);
  assert.equal(session.controller('display:primary').getSnapshot().gridId, draft.grids[0].id);
});
test('reopening a Display does not reapply an unchanged entry link', () => {
  const draft = content(), session = createSceneSession(scope, draft), control = session.controller('display:primary');
  assert.equal(control.enter('grid:two'), true);
  control.next();
  assert.equal(control.enter('grid:two'), false);
  assert.equal(control.getSnapshot().gridId, draft.grids[0].id);
  control.enter(null);
  assert.equal(control.enter('grid:two'), true);
});
test('authoring and presentation share one temporary selection without draft writes or undo entries', () => {
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const store = createSystemWorkflowDraftStore({ profileAddress, storage });
  store.commitCompletedOperation(content(), { expectedGeneration: store.getGeneration() });
  const scenes = createSceneSession(scope, store.getSnapshot()), navigation = scenes.controller('display:primary');
  const owner = createDisplayModuleSession(store, 'display:primary', navigation);
  const saved = [...values], history = store.getHistory(), generation = store.getGeneration();
  owner.selectGrid('grid:two');
  assert.equal(scenes.getSnapshot()['display:primary'].gridId, 'grid:two');
  const remounted = createDisplayModuleSession(store, 'display:primary', navigation);
  assert.equal(remounted.getSnapshot().selectedGridId, 'grid:two');
  navigation.next();
  assert.equal(owner.getSnapshot().selectedGridId, store.getDraft().grids[0].id);
  assert.deepEqual([...values], saved); assert.deepEqual(store.getHistory(), history); assert.equal(store.getGeneration(), generation);
});
