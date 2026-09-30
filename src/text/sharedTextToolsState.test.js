import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreTextToolsView } from './sharedTextToolsState.js';
import { createArticle } from './domain/article.js';
import { createEmptySystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { createDefaultWorkbenchPresentation, createTextPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { loadWorkbenchLayout, saveWorkbenchLayout } from '../public/ownerSystemWorkflow/workbenchLayoutStorage.js';

test('old per-Text windows consolidate to one available target without changing modes or content', () => {
  const records = ['text:a', 'text:b', 'text:c'].map(id => ({ id, article: createArticle(), visibility: 'PRIVATE' }));
  const views = { 'text:a': { mode: 'write', settings: true }, 'text:b': { mode: 'read', settings: true }, 'text:c': { mode: 'write', settings: true } };
  const before = JSON.stringify({ records, views });
  assert.deepEqual(restoreTextToolsView(views, records, [{ id: 'text:a', open: false }]), { open: true, targetId: 'text:b' });
  assert.deepEqual(restoreTextToolsView({ ...views, 'workbench:text-tools': { open: false } }, records), { open: false });
  assert.deepEqual(restoreTextToolsView({}, records), { open: true, targetId: 'text:a' });
  assert.deepEqual(restoreTextToolsView({}, []), { open: false });
  assert.equal(JSON.stringify({ records, views }), before);
});

test('shared Text visibility and target reload separately from article modes and authored data', () => {
  const profile = `0x${'1'.repeat(40)}`, draft = createEmptySystemWorkflowDraft(profile);
  draft.texts = [{ id: 'text:a', article: createArticle(), visibility: 'PRIVATE' }];
  const layout = createDefaultWorkbenchPresentation(); layout.texts = [createTextPresentation('text:a')];
  const map = new Map(), storage = { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) };
  const before = JSON.stringify(draft);
  const views = { 'text:a': { mode: 'write' }, 'workbench:text-tools': { open: true },
    'workbench:tools': { layers: false, metadata: false, windows: {}, targetId: 'text:a' } };
  assert.ok(saveWorkbenchLayout(profile, draft, layout, views, storage));
  assert.deepEqual(loadWorkbenchLayout(profile, draft, storage).views, views);
  assert.equal(JSON.stringify(draft), before);
  assert.deepEqual(loadWorkbenchLayout(`0x${'2'.repeat(40)}`, draft, storage).views, {});
});
