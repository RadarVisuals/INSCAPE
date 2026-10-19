import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireProfileEditor, captureProfileDraftWriteAccess } from './profileEditorLease.js';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';

const profile = `0x${'1'.repeat(40)}`, other = `0x${'2'.repeat(40)}`;
function locks() {
  const active = new Set();
  return { request: async (name, options, callback) => {
    assert.equal(options.ifAvailable, true); assert.equal(options.mode, 'exclusive');
    if (active.has(name)) return callback(null);
    active.add(name); try { return await callback({ name }); } finally { active.delete(name); }
  } };
}
test('exclusive editor scopes profiles, rejects competitors and revokes stale store writes after release', async () => {
  const previous = globalThis.window, records = new Map();
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) };
  globalThis.window = { localStorage: storage };
  const manager = locks(), first = acquireProfileEditor(profile, manager);
  try {
    assert.equal(await first.ready, 'editing');
    const competing = acquireProfileEditor(profile, manager); assert.equal(await competing.ready, 'busy');
    assert.equal(captureProfileDraftWriteAccess(profile, storage)(), true);
    const different = acquireProfileEditor(other, manager); assert.equal(await different.ready, 'editing'); different.stop();
    const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage, requireEditor: true });
    const draft = store.getDraft(); draft.identityPresentation.alias = 'Editor';
    assert.equal(store.commitCompletedOperation(draft, { expectedGeneration: 0 }), true);
    const accepted = store.getDraft(), history = store.getHistory(); first.stop(); await Promise.resolve();
    assert.equal(store.commitCompletedOperation(accepted, { expectedGeneration: store.getGeneration() }), false);
    assert.equal(store.getLastCommitFailure(), 'editor_unavailable');
    assert.equal(store.undo(), false); assert.deepEqual(store.getHistory(), history);
    assert.equal(store.restoreBackup(accepted, { expectedGeneration: store.getGeneration() }), false);
    const next = acquireProfileEditor(profile, manager); assert.equal(await next.ready, 'editing');
    assert.equal(store.commitCompletedOperation(accepted, { expectedGeneration: store.getGeneration() }), false);
    const fresh = createSystemWorkflowDraftStore({ profileAddress: profile, storage, requireEditor: true });
    assert.equal(fresh.commitCompletedOperation(fresh.getDraft(), { expectedGeneration: fresh.getGeneration() }), true);
    next.stop();
  } finally { first.stop(); if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});
test('unsupported, denied and cancelled acquisition never grants editing', async () => {
  assert.equal(await acquireProfileEditor(profile, null).ready, 'unsupported');
  assert.equal(await acquireProfileEditor(profile, { request() { throw Error('denied'); } }).ready, 'unavailable');
  assert.equal(await acquireProfileEditor(profile, { request: () => Promise.reject(Error('denied')) }).ready, 'unavailable');
  let grant, reached;
  const started = new Promise(resolve => { reached = resolve; });
  const lease = acquireProfileEditor(profile, { request: async (_name, _options, callback) => { await new Promise(resolve => { grant = resolve; reached(); }); return callback({}); } });
  await started;
  lease.stop(); grant(); assert.equal(await lease.ready, 'released');
});

test('an immediate dispose/remount waits for its own release instead of reporting another tab', async () => {
  const manager = locks();
  const a = acquireProfileEditor(profile, manager); assert.equal(await a.ready, 'editing');
  a.stop(); const b = acquireProfileEditor(profile, manager);
  assert.equal(await b.ready, 'editing'); b.stop();
  const cancelled = acquireProfileEditor(profile, manager); cancelled.stop();
  const remount = acquireProfileEditor(profile, manager);
  assert.equal(await remount.ready, 'editing'); remount.stop();
});
