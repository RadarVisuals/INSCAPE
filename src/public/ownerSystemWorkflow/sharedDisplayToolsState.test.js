import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreSharedTools, validSharedTools } from './sharedDisplayToolsState.js';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { createDefaultWorkbenchPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { loadWorkbenchLayout, saveWorkbenchLayout } from './workbenchLayoutStorage.js';

test('old per-Display tools consolidate without modifying old records; shared settings take precedence', () => {
  const views = { 'display:primary': { instruments: { active: 'layers', layers: 'attached', metadata: 'attached' },
    instrumentWindows: { layers: { left: 20, top: 60, width: 320, height: 480 } } },
    second: { instruments: { active: null, layers: 'closed', metadata: 'detached' } } };
  const bytes = JSON.stringify(views);
  const result = restoreSharedTools(views);
  assert.equal(result.layers, true); assert.equal(result.metadata, true);
  assert.deepEqual(result.windows.layers, views['display:primary'].instrumentWindows.layers);
  assert.equal(JSON.stringify(views), bytes);
  const closed = { layers: false, metadata: false, windows: {}, targetId: null };
  assert.deepEqual(restoreSharedTools({ ...views, 'workbench:tools': closed }), closed);
});
test('shared view survives local reload without entering authored layout, and rejects malformed geometry', () => {
  const profile = `0x${'1'.repeat(40)}`, draft = createEmptySystemWorkflowDraft(profile), before = JSON.stringify(draft);
  const records = new Map(), storage = { getItem: k => records.get(k) ?? null, setItem: (k, v) => records.set(k, v) };
  const tools = { layers: true, metadata: false, windows: { layers: { left: 80, top: 100, width: 340, height: 500 } }, targetId: 'display:primary' };
  assert.ok(saveWorkbenchLayout(profile, draft, createDefaultWorkbenchPresentation(), { 'workbench:tools': tools }, storage));
  assert.deepEqual(loadWorkbenchLayout(profile, draft, storage).views['workbench:tools'], tools);
  assert.equal(JSON.stringify(draft), before);
  assert.equal(validSharedTools({ ...tools, metadata: 'yes' }), false);
  assert.equal(validSharedTools({ ...tools, animation: true }), false);
  assert.equal(validSharedTools({ ...tools, windows: { layers: { left: 0, top: 0, width: 0, height: 0 } } }), false);
});
