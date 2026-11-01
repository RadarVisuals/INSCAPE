import assert from 'node:assert/strict';
import test from 'node:test';
import { articleNodeSize, articleFlowSlice } from './articleFlow.js';
import { createArticle } from './domain/article.js';
import { isValidWorkbenchPresentation, createDefaultWorkbenchPresentation, createTextPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { createEmptySystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { changeTextFrames } from './textSession.js';
import { commitWorkbenchSelectionResize } from '../systemWorkflow/resizeWorkbenchSelection.js';
import { prepareTextResize } from './textSession.js';

const profile = '0x1111111111111111111111111111111111111111';
const text = node => node.type === 'text' ? node.text : (node.content || []).map(text).join('');
const createDraft = () => {
  const draft = createEmptySystemWorkflowDraft(profile);
  draft.texts = [{ id: 'text:story', article: createArticle('Story'), visibility: 'PUBLIC' }];
  draft.workbench = { ...createDefaultWorkbenchPresentation(), texts: [createTextPresentation('text:story')] };
  return draft;
};
const continuation = id => ({ id: `text-frame:${id}`, window: { left: 900, top: 120, width: 400, height: 300 } });

test('flow fragments preserve marked Unicode text and nested lists at every possible frame break', () => {
  const content = { type: 'doc', content: [
    { type: 'paragraph', attrs: { spaceBefore: 20, spaceAfter: 30 }, content: [{ type: 'text', text: 'A keeper 👁 watches.', marks: [{ type: 'bold' }] }] },
    { type: 'orderedList', attrs: { start: 4 }, content: ['First item.', 'Second item.'].map(value => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }] })) },
  ] };
  const original = JSON.stringify(content), size = articleNodeSize(content);
  for (let split = 1; split < size; split++) {
    const first = articleFlowSlice(content, 0, split), next = articleFlowSlice(content, split, size);
    assert.equal(text(first.content) + text(next.content), text(content));
    assert.equal(JSON.stringify(content), original, 'render fragments never mutate the source');
  }
  assert.equal(articleFlowSlice(content, 4, 12).content.content[0].attrs.spaceBefore, 0);
  assert.equal(articleFlowSlice(content, 4, 12).content.content[0].attrs.spaceAfter, 0);
  assert.deepEqual(articleFlowSlice(content, 4, 12).content.content[0].content[0].marks, [{ type: 'bold' }]);
});

test('old layouts keep their bytes and linked frame geometry survives publication and restoration without article copies', () => {
  const draft = createDraft(), original = JSON.stringify(draft);
  assert.equal(isValidWorkbenchPresentation(draft.workbench), true); assert.equal(JSON.stringify(draft), original);
  draft.workbench.texts[0].frames = [continuation('two'), continuation('three')];
  const document = buildProfileDocumentV9({ systemWorkflowDraft: draft, profileAddress: profile, createdAt: 1 });
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(document);
  assert.deepEqual(restored.workbench.texts, draft.workbench.texts);
  assert.equal(document.texts.length, 1); assert.deepEqual(document.texts[0].article, draft.texts[0].article);
  const invalid = value => { const layout = structuredClone(draft.workbench); layout.texts[0].frames = value; assert.equal(isValidWorkbenchPresentation(layout), false); };
  invalid([]); invalid([continuation('two'), continuation('two')]); invalid(Array.from({ length: 8 }, (_, i) => continuation(String(i))));
  invalid([{ ...continuation('two'), article: createArticle() }]); invalid([{ ...continuation('two'), window: { ...continuation('two').window, height: -1 } }]);
});

test('adding, resizing and removing continuation frames are atomic, undoable and scoped to the originating article', () => {
  const seed = createDraft(), map = new Map();
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage: { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value) } });
  assert.ok(store.commitCompletedOperation(seed, { expectedGeneration: store.getGeneration() }));
  const record = store.getDraft().texts[0], layout = seed.workbench.texts[0];
  changeTextFrames(store, profile, record, layout, [continuation('two')], seed.workbench);
  assert.equal(store.getDraft().texts.length, 1); assert.deepEqual(store.getDraft().texts[0], record);
  assert.ok(commitWorkbenchSelectionResize([{ id: 'text-frame:two', parentTextId: record.id, layoutKey: 'texts', store, profileAddress: profile,
    expected: record, prepare: prepareTextResize, left: 450, top: 400, width: 360, height: 240 }]));
  assert.deepEqual(store.getDraft().workbench.texts[0].frames[0].window, { left: 450, top: 400, width: 360, height: 240 });
  assert.throws(() => changeTextFrames(store, '0x2222222222222222222222222222222222222222', record, layout, [], seed.workbench));
  const current = store.getDraft();
  changeTextFrames(store, profile, record, current.workbench.texts[0], [], current.workbench);
  assert.equal(store.getDraft().workbench.texts[0].frames, undefined); assert.deepEqual(store.getDraft().texts[0], record);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft().workbench.texts[0].frames, current.workbench.texts[0].frames);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft().workbench.texts[0].frames, [continuation('two')]);
  assert.ok(store.undo()); assert.equal(store.getDraft().workbench.texts[0].frames, undefined);
  assert.ok(store.redo()); assert.deepEqual(store.getDraft().workbench.texts[0].frames, [continuation('two')]);
  assert.deepEqual(store.getDraft().texts[0], record);
});

test('a failed frame save retains the previous layout and the full article', () => {
  const seed = createDraft(), map = new Map(); let fail = false;
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage: { getItem: key => map.get(key) || null,
    setItem: (key, value) => { if (fail) throw Error('storage full'); map.set(key, value); } } });
  assert.ok(store.commitCompletedOperation(seed, { expectedGeneration: store.getGeneration() }));
  fail = true;
  assert.throws(() => changeTextFrames(store, profile, seed.texts[0], seed.workbench.texts[0], [continuation('two')], seed.workbench), /could not be saved/u);
  assert.deepEqual(store.getDraft(), seed);
});
