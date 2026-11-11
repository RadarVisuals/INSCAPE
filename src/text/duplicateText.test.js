import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { addTextModule, duplicateTextModule, changeTextFrames, saveTextModuleResult } from './textSession.js';
import { workbenchArea, workbenchAreaBounds } from '../systemWorkflow/domain/workbenchArea.js';

const profile = `0x${'4'.repeat(40)}`;
function fixture() {
  const values = new Map(); let fail = false;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('full'); values.set(key, value); } };
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  const id = addTextModule(store, profile, { position: { left: 100, top: 120 } });
  const source = store.getSnapshot().texts[0];
  assert.equal(saveTextModuleResult(store, profile, source, { ...source, article: { ...source.article,
    title: 'A complete article', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Retain this text.', marks: [{ type: 'bold' }] }] }] } } }).saved, true);
  return { store, storage, id, fail: value => { fail = value; } };
}

test('Text duplication retains the article and independent linked frames in one undoable saved operation', () => {
  const { store, storage, id } = fixture();
  const source = store.getSnapshot().texts[0], layout = store.getSnapshot().workbench;
  changeTextFrames(store, profile, source, layout.texts[0], [{ id: 'text-frame:original', window: { left: 700, top: 200, width: 300, height: 400 } }], layout);
  const before = store.getDraft(), copyId = duplicateTextModule(store, profile, source, before.workbench);
  const after = store.getDraft(), copy = after.texts.find(item => item.id === copyId);
  assert.notEqual(copyId, id); assert.deepEqual(copy, { ...source, id: copyId });
  assert.deepEqual(after.texts[0], source);
  const window = after.workbench.texts.find(item => item.id === copyId), original = before.workbench.texts[0];
  assert.notEqual(window.frames[0].id, original.frames[0].id);
  assert.deepEqual(window.frames[0].window, { ...original.frames[0].window, left: 724, top: 224 });
  assert.equal(window.window.left, original.window.left + 24);
  assert.equal(store.undo(), true); assert.deepEqual(store.getDraft(), before);
  assert.equal(store.redo(), true); assert.deepEqual(store.getDraft(), after);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), after);
});

test('Text duplication rejects stale sources, wrong profiles, capacity and failed storage without partial copies', () => {
  const { store, fail } = fixture(), source = store.getSnapshot().texts[0], before = store.getDraft();
  assert.throws(() => duplicateTextModule(store, 'wrong-profile', source), /no longer active/u);
  assert.throws(() => duplicateTextModule(store, profile, { ...source, visibility: 'PUBLIC' }), /Text changed/u);
  fail(true); assert.throws(() => duplicateTextModule(store, profile, source), /could not be saved/u); fail(false);
  assert.deepEqual(store.getDraft(), before);
  for (let index = 1; index < 16; index++) duplicateTextModule(store, profile, source);
  const full = store.getDraft();
  assert.throws(() => duplicateTextModule(store, profile, source), /At most 16/u);
  assert.deepEqual(store.getDraft(), full);
});

test('linked Text frames keep their relative positions when the copy meets the canvas edge', () => {
  const { store } = fixture(), source = store.getSnapshot().texts[0], layout = store.getSnapshot().workbench;
  const bounds = workbenchAreaBounds(workbenchArea(layout));
  const frame = { id: 'text-frame:edge', window: { left: bounds.right - 300, top: 200, width: 300, height: 400 } };
  changeTextFrames(store, profile, source, layout.texts[0], [frame], layout);
  const before = store.getDraft().workbench.texts[0];
  const id = duplicateTextModule(store, profile, source);
  const copy = store.getDraft().workbench.texts.find(item => item.id === id);
  assert.equal(copy.frames[0].window.left - copy.window.left, before.frames[0].window.left - before.window.left);
  assert.equal(copy.frames[0].window.top - copy.window.top, before.frames[0].window.top - before.window.top);
  assert.equal(copy.frames[0].window.left + copy.frames[0].window.width, bounds.right);
});
