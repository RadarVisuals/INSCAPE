import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { addTextModule, saveTextModuleResult } from './textSession.js';
import { validTextModules } from './domain/article.js';
import { createDefaultWorkbenchPresentation, createTextPresentation, isValidWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { passageArticle } from './scenePassages.js';

test('16 linked Text modules and their windows save, reload, publish and restore without dropping articles', () => {
  const entries = new Map(), storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  const profileAddress = `0x${'1'.repeat(40)}`;
  const store = createSystemWorkflowDraftStore({ profileAddress, storage });
  for (let index = 0; index < 16; index++) {
    const id = addTextModule(store, profileAddress), before = store.getDraft().texts.find(t => t.id === id);
    const paragraph = text => ({ type: 'paragraph', content: [{ type: 'text', text }] });
    const next = { ...before, visibility: 'PUBLIC', sceneLink: { mode: 'sections', displayId: 'display:primary' },
      article: { ...before.article, title: `Article ${index + 1}`, content: { type: 'doc', content: [paragraph(`Opening ${index + 1}`), { type: 'pageBreak' }, paragraph(`Ending ${index + 1}`)] } } };
    assert.ok(saveTextModuleResult(store, profileAddress, before, next).saved);
    if (index === 3) assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress, storage }).getDraft().texts, store.getDraft().texts, 'old four-module drafts still load');
  }
  const draft = store.getDraft(), first = draft.grids.find(g => g.visibility === 'PUBLIC');
  draft.grids.push({ ...structuredClone(first), id: 'grid:second' });
  draft.workbench = { ...createDefaultWorkbenchPresentation(), texts: draft.texts.map((t, index) => createTextPresentation(t.id, index)) };
  assert.ok(store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration(), historyLabel: 'Arrange Text modules' }));
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress, storage }).getDraft(), draft);
  assert.throws(() => addTextModule(store, profileAddress), /At most 16/);
  assert.deepEqual(store.getDraft(), draft, 'attempting a seventeenth module preserves saved work');
  const document = buildProfileDocumentV9({ systemWorkflowDraft: draft, profileAddress, assetRecords: [] });
  assert.equal(document.texts.length, 16);
  assert.equal(document.workbench.texts.length, 16);
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(document, draft);
  assert.deepEqual(restored.texts, draft.texts);
  assert.deepEqual(restored.workbench.texts, draft.workbench.texts);
  restored.texts.forEach((item, index) => assert.match(JSON.stringify(passageArticle(item, 'grid:second', [first.id, 'grid:second'])), new RegExp(`Ending ${index + 1}`)));
  assert.equal(validTextModules([...draft.texts, { ...draft.texts[0], id: 'text:overflow' }]), false);
  assert.equal(isValidWorkbenchPresentation({ ...draft.workbench, texts: [...draft.workbench.texts, createTextPresentation('text:overflow')] }), false);
});
