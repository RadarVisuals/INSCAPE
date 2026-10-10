import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { openMobileModule, updateMobileModule } from '../mobile/mobileSession.js';
import { createMobilePresentation, upgradeMobilePresentation, validMobilePresentation } from '../mobile/domain/mobilePresentation.js';
import { createSystemWorkflowAuthoringSession } from './systemWorkflowAuthoringSession.js';
const profile = '0x1111111111111111111111111111111111111111';
function setup() {
  const values = new Map(), storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  return { storage, values, store: createSystemWorkflowDraftStore({ profileAddress: profile, storage }) };
}
test('chronological undo crosses Mobile and Display and persists each successful restoration', () => {
  const { store, storage } = setup(); openMobileModule(store);
  const before = store.getDraft();
  updateMobileModule(store, profile, m => ({ ...m, theme: 'light' }));
  const session = createSystemWorkflowAuthoringSession({ store }); session.createGrid();
  assert.equal(store.undo(), true); assert.equal(store.getDraft().grids.length, before.grids.length);
  assert.ok(session.getState().draft.grids.some(grid => grid.id === session.getState().selectedGridId));
  assert.equal(store.getDraft().mobile.theme, 'light');
  assert.equal(store.undo(), true); assert.deepEqual(store.getDraft(), before);
  assert.equal(store.redo(), true); assert.equal(store.getDraft().mobile.theme, 'light');
  assert.equal(store.redo(), true); assert.equal(store.getDraft().grids.length, before.grids.length + 1);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), store.getDraft());
});
test('view changes are not undo steps and do not prevent undoing module creation', () => {
  const { store } = setup(); openMobileModule(store);
  updateMobileModule(store, profile, m => ({ ...m, editor: { open: false } }), null);
  assert.equal(store.undo(), true); assert.equal(store.getDraft().mobile, undefined);
  assert.equal(store.redo(), true); assert.ok(store.getDraft().mobile);
});
test('failed writes and external edits preserve both draft and history', () => {
  const { store, storage, values } = setup(); openMobileModule(store);
  const before = store.getDraft(), history = store.getHistory(), setItem = storage.setItem;
  storage.setItem = () => { throw new Error('quota'); };
  assert.equal(store.undo(), false); assert.deepEqual(store.getDraft(), before); assert.deepEqual(store.getHistory(), history);
  storage.setItem = setItem;
  values.set([...values.keys()][0], '{}'); assert.equal(store.undo(), false);
  assert.deepEqual(store.getDraft(), before); assert.deepEqual(store.getHistory(), history);
});
test('a new edit clears redo; profile history is isolated and reload clears it', () => {
  const { store } = setup(); openMobileModule(store); updateMobileModule(store, profile, m => ({ ...m, theme: 'light' }));
  store.undo(); updateMobileModule(store, profile, m => ({ ...m, index: { ...m.index, title: 'New heading' } }));
  assert.equal(store.redo(), false);
  store.setProfileAddress('0x2222222222222222222222222222222222222222'); assert.equal(store.undo(), false);
  store.setProfileAddress(profile); assert.ok(store.getHistory().undo); store.reload(); assert.equal(store.undo(), false);
});
test('v1 compositions remain valid; upgrade adds neutral transforms without changing authored content', () => {
  const old = createMobilePresentation(); old.front.positions.name.x = .6;
  const next = upgradeMobilePresentation(old);
  assert.equal(old.version, 1); assert.equal(next.version, 2);
  assert.equal(validMobilePresentation(old), true); assert.equal(validMobilePresentation(next), true);
  const { transforms, ...front } = next.front; assert.deepEqual(front, old.front);
  assert.deepEqual(transforms.mask, { quarterTurns: 0, mirrorX: false, mirrorY: false });
  next.front.transforms.artwork.quarterTurns = 4; assert.equal(validMobilePresentation(next), false);
});
test('continuous control updates group into one gesture and cannot cross an undo boundary', () => {
  const { store } = setup(); openMobileModule(store);
  const before = store.getDraft(); store.beginHistoryGroup();
  for (const scale of [1.1, 1.2, 1.3]) updateMobileModule(store, profile, m => ({ ...m, front: { ...m.front, image: { ...m.front.image, scale } } }));
  store.endHistoryGroup(); assert.equal(store.undo(), true); assert.deepEqual(store.getDraft(), before);
  assert.equal(store.redo(), true); assert.equal(store.getDraft().mobile.front.image.scale, 1.3);
});
