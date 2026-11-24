import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { removeWorkbenchModule } from './removeWorkbenchModule.js';
import { addShape } from '../shapes/shapeSession.js';
const profile = `0x${'1'.repeat(40)}`;
function fixture() {
  const entries = new Map(); let failed = false;
  const storage = { getItem: k => entries.get(k) ?? null, setItem: (k,v) => { if (failed) throw Error('Storage unavailable'); entries.set(k,v); } };
  return { store: createSystemWorkflowDraftStore({ profileAddress: profile, storage }), storage, fail: () => { failed = true; } };
}
test('Shape deletion is undoable and persists after reopening', () => {
  const { store, storage } = fixture();
  addShape(store, profile);
  const before = store.getDraft();
  assert.equal(removeWorkbenchModule(store, profile, 'shape', before.shapes[0]), true);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft().shapes, []);
  assert.ok(store.undo());
  assert.deepEqual(store.getDraft(), before);
});
test('deletion rejects obsolete context and failed persistence without losing content', () => {
  const { store, fail } = fixture(); addShape(store, profile);
  const record = store.getDraft().shapes[0];
  assert.equal(removeWorkbenchModule(store, `0x${'2'.repeat(40)}`, 'shape', record), false);
  assert.equal(removeWorkbenchModule(store, profile, 'shape', { ...record, name: 'Obsolete name' }), false);
  const before = store.getDraft(); fail();
  assert.equal(removeWorkbenchModule(store, profile, 'shape', record), false);
  assert.deepEqual(store.getDraft(), before);
});
