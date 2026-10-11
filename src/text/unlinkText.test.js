import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { createArticle, MAX_TEXT_MODULES } from './domain/article.js';
import { unlinkTextModuleResult } from './textSession.js';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';
const profile = `0x${'1'.repeat(40)}`;
function fixture(legacy = false) {
  const entries = new Map(); let fail = false;
  const storage = { getItem: k => entries.get(k) ?? null, setItem: (k, v) => { if (fail) throw Error('full'); entries.set(k, v); } };
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  const draft = store.getDraft();
  const article = { ...createArticle('Preserved'), content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First section' }] }, { type: 'pageBreak' }, { type: 'paragraph', content: [{ type: 'text', text: 'Second section' }] }] } };
  draft.texts = [{ id: 'text:story', visibility: 'PUBLIC', article, sceneLink: legacy
    ? { displayId: 'display:primary', gridId: draft.grids[0].id, passages: [{ gridId: 'missing-grid', article: { ...createArticle('Separate passage'), appearance: { background: '#101111', opacity: .7, frame: true, scale: 1, fontSize: 22, color: '#ffffff' } } }] }
    : { mode: 'sections', displayId: 'display:primary' } }];
  assert.ok(store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() }));
  return { store, storage, fail: () => { fail = true; } };
}
test('unlink recovers the complete article after Display deletion, persists, and is undoable', () => {
  const { store, storage } = fixture(); const linked = store.getDraft().texts[0];
  assert.ok(removeWorkbenchModule(store, profile, 'display', { id: 'display:primary', grids: store.getDraft().grids }));
  const before = store.getDraft();
  assert.equal(unlinkTextModuleResult(store, profile, linked).saved, true);
  const result = store.getDraft().texts[0]; assert.equal(result.sceneLink, undefined); assert.deepEqual(result.article, linked.article);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft().texts[0], result);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), before); assert.ok(store.redo());
  assert.deepEqual(store.getDraft().texts[0], result);
});
test('legacy unlink preserves every complete article in one atomic undoable operation', () => {
  const { store } = fixture(true), before = store.getDraft(), linked = before.texts[0];
  assert.equal(unlinkTextModuleResult(store, profile, linked).saved, true);
  const after = store.getDraft(); assert.equal(after.texts.length, 2);
  assert.deepEqual(after.texts[0].article, linked.article);
  assert.deepEqual(after.texts[1].article, linked.sceneLink.passages[0].article);
  assert.equal(after.texts[1].visibility, 'PRIVATE'); assert.ok(after.texts.every(t => !t.sceneLink));
  assert.ok(after.workbench.texts.find(t => t.id === after.texts[1].id)?.open);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), before);
});
test('failed, stale, wrong-profile and over-capacity unlink never discard stored passages', () => {
  const { store, fail } = fixture(true), before = store.getDraft(), linked = before.texts[0];
  assert.equal(unlinkTextModuleResult(store, 'other', linked).reason, 'profile');
  assert.equal(unlinkTextModuleResult(store, profile, { ...linked, visibility: 'PRIVATE' }).reason, 'conflict');
  const full = { ...before, texts: [...before.texts, ...Array.from({ length: MAX_TEXT_MODULES - 1 }, (_, i) => ({ id: `text:extra-${i}`, article: createArticle(), visibility: 'PRIVATE' }))] };
  assert.ok(store.commitCompletedOperation(full, { expectedGeneration: store.getGeneration() }));
  assert.equal(unlinkTextModuleResult(store, profile, linked).reason, 'capacity'); assert.deepEqual(store.getDraft(), full);
  assert.ok(store.undo()); fail();
  assert.equal(unlinkTextModuleResult(store, profile, linked).saved, false); assert.deepEqual(store.getDraft(), before);
});
