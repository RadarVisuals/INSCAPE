import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreSharedTools, validSharedTools } from './sharedDisplayToolsState.js';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { createDefaultWorkbenchPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { loadWorkbenchLayout, saveWorkbenchLayout } from './workbenchLayoutStorage.js';

test('missing or invalid shared tools restore fresh closed windows', () => {
  const expected = { layers: false, metadata: false, windows: {} };
  assert.deepEqual(restoreSharedTools(), expected);
  assert.deepEqual(restoreSharedTools({ 'workbench:tools': { layers: 'yes' } }), expected);
  const first = restoreSharedTools();
  first.windows.layers = { left: 0, top: 0, width: 320, height: 480 };
  assert.deepEqual(restoreSharedTools(), expected);
  const closed = { ...expected, targetId: null };
  assert.deepEqual(restoreSharedTools({ 'workbench:tools': closed }), closed);
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
  const appearance = { ...tools, appearance: true, windows: { appearance: { left: 40, top: 80, width: 320, height: 470 } } };
  assert.ok(saveWorkbenchLayout(profile, draft, createDefaultWorkbenchPresentation(), { 'workbench:tools': appearance }, storage));
  assert.deepEqual(loadWorkbenchLayout(profile, draft, storage).views['workbench:tools'], appearance);
  assert.equal(validSharedTools({ ...appearance, appearance: 'yes' }), false);
});
