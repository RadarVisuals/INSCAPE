import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWorkbenchLayout, saveWorkbenchLayout, workbenchLayoutKey } from './workbenchLayoutStorage.js';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { createDefaultWorkbenchPresentation, createTextPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { createArticle } from '../../text/domain/article.js';
const profile = `0x${'1'.repeat(40)}`;
const storage = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) }; };

test('local layout survives reload without mutating authored content or publication layout', () => {
  const store = storage(), draft = createEmptySystemWorkflowDraft(profile), before = structuredClone(draft);
  const layout = createDefaultWorkbenchPresentation(); layout.display.window.left = 211; layout.display.open = false;
  const views = { 'display:primary': { gridId: draft.grids[1].id, locked: true, instruments: { active: null, layers: 'attached', metadata: 'attached' } } };
  assert.deepEqual(loadWorkbenchLayout(profile, draft, store), { layout: null, views: {} });
  assert.equal(saveWorkbenchLayout(profile, draft, layout, views, store), true);
  assert.deepEqual(loadWorkbenchLayout(profile, draft, store), { layout, views });
  views['display:primary'].instrumentWindows = { layers: { left: 120, top: 80, width: 360, height: 500 } };
  assert.equal(saveWorkbenchLayout(profile, draft, layout, views, store), true);
  assert.deepEqual(loadWorkbenchLayout(profile, draft, store).views, views);
  assert.deepEqual(draft, before);
  assert.equal(loadWorkbenchLayout(`0x${'2'.repeat(40)}`, draft, store).layout, null);
});
test('removed modules never return from cached geometry; restored authored layouts invalidate the local view', () => {
  const store = storage(), draft = createEmptySystemWorkflowDraft(profile);
  draft.texts = [{ id: 'text:one', article: createArticle(), visibility: 'PRIVATE' }];
  const layout = createDefaultWorkbenchPresentation(); layout.texts = [createTextPresentation('text:one')];
  const views = { 'text:one': { mode: 'read', settings: false } };
  saveWorkbenchLayout(profile, draft, layout, views, store);
  assert.deepEqual(loadWorkbenchLayout(profile, draft, store).views, views);
  const removed = { ...draft, texts: [] };
  assert.deepEqual(loadWorkbenchLayout(profile, removed, store).layout.texts, []);
  assert.deepEqual(loadWorkbenchLayout(profile, removed, store).views, {});
  assert.equal(loadWorkbenchLayout(profile, { ...draft, workbench: createDefaultWorkbenchPresentation() }, store).layout, null);
});
test('invalid and unreadable layouts remain intact, and failed writes are reported', () => {
  const store = storage(), draft = createEmptySystemWorkflowDraft(profile);
  store.setItem(workbenchLayoutKey(profile), 'broken');
  assert.equal(loadWorkbenchLayout(profile, draft, store).blocked, true);
  assert.equal(store.getItem(workbenchLayoutKey(profile)), 'broken');
  assert.equal(loadWorkbenchLayout(profile, draft, { getItem() { throw Error('denied'); } }).blocked, true);
  assert.equal(saveWorkbenchLayout(profile, draft, createDefaultWorkbenchPresentation(), {}, { setItem() { throw Error('full'); } }), false);
});
