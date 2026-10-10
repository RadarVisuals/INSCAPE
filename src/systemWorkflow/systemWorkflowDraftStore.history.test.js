import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from './systemWorkflowDraftStore.js';
import { createSystemWorkflowAuthoringSession } from './systemWorkflowAuthoringSession.js';

const profileA = '0x1111111111111111111111111111111111111111';
const profileB = '0x2222222222222222222222222222222222222222';
const keyA = systemWorkflowDraftKey(profileA);
function setup() {
  const records = new Map();
  const storage = {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  };
  const store = createSystemWorkflowDraftStore({ profileAddress: profileA, storage });
  const editSubtitle = (index, subtitle) => {
    const draft = store.getDraft();
    draft.grids[index].subtitle = subtitle;
    assert.equal(store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() }), true);
  };
  return { records, storage, store, editSubtitle };
}

test('returning to externally reordered Display Grids discards history instead of editing the wrong Grid', () => {
  const { storage, store, editSubtitle } = setup();
  createSystemWorkflowAuthoringSession({ store }).createGrid();
  editSubtitle(1, 'Edited');
  store.reload();
  editSubtitle(0, 'Edited');
  const editedGridId = store.getDraft().grids[0].id;
  store.setProfileAddress(profileB);

  const otherTab = createSystemWorkflowDraftStore({ profileAddress: profileA, storage });
  const reordered = otherTab.getDraft();
  [reordered.grids[0], reordered.grids[1]] = [reordered.grids[1], reordered.grids[0]];
  assert.equal(otherTab.commitCompletedOperation(reordered, { expectedGeneration: otherTab.getGeneration() }), true);
  const saved = storage.getItem(keyA);
  store.setProfileAddress(profileA);
  assert.notEqual(store.getDraft().grids[0].id, editedGridId);
  assert.deepEqual(store.getHistory(), { undo: null, redo: null });
  assert.equal(store.undo(), false);
  assert.deepEqual(store.getDraft(), reordered);
  assert.equal(storage.getItem(keyA), saved);
});

test('unchanged profiles retain independent undo and redo across switches', () => {
  const { store, editSubtitle } = setup();
  const beforeA = store.getDraft();
  editSubtitle(0, 'A edits');
  const afterA = store.getDraft();
  assert.equal(store.undo(), true);
  store.setProfileAddress(profileB);
  const beforeB = store.getDraft();
  editSubtitle(0, 'B edits');
  const afterB = store.getDraft();
  store.setProfileAddress(profileA);
  assert.equal(store.redo(), true);
  assert.deepEqual(store.getDraft(), afterA);
  assert.equal(store.undo(), true);
  assert.deepEqual(store.getDraft(), beforeA);
  store.setProfileAddress(profileB);
  assert.deepEqual(store.getDraft(), afterB);
  assert.equal(store.undo(), true);
  assert.deepEqual(store.getDraft(), beforeB);
});

for (const change of ['missing', 'corrupt', 'unavailable']) test(`a ${change} returning profile clears only its obsolete history without writing`, () => {
  const { records, storage, store, editSubtitle } = setup();
  editSubtitle(0, 'A edits');
  store.setProfileAddress(profileB);
  editSubtitle(0, 'B edits');
  const savedB = store.getDraft();
  const getItem = storage.getItem;
  if (change === 'missing') records.delete(keyA);
  if (change === 'corrupt') records.set(keyA, '{unreadable');
  if (change === 'unavailable') storage.getItem = key => {
    if (key === keyA) throw new Error('read unavailable');
    return getItem(key);
  };
  const rawA = records.get(keyA);
  store.setProfileAddress(profileA);
  assert.deepEqual(store.getHistory(), { undo: null, redo: null });
  assert.equal(store.undo(), false);
  assert.equal(records.get(keyA), rawA, 'switching and rejected undo never overwrite saved bytes');
  storage.getItem = getItem;
  store.setProfileAddress(profileB);
  assert.deepEqual(store.getDraft(), savedB);
  assert.equal(store.undo(), true, 'another profile retains its own history');
  assert.equal(store.getDraft().grids[0].subtitle, '');
});
