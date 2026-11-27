import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { createWorkbenchSession } from './workbenchSession.js';
import { createDefaultWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';
const profile = `0x${'1'.repeat(40)}`;
test('saving a workbench layout preserves history and rejects a stale profile session', () => {
  const values = new Map(), storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  const draft = store.getDraft();
  store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() });
  const history = store.getHistory();
  assert.equal(createWorkbenchSession({ store }).saveWorkbench(createDefaultWorkbenchPresentation()), true);
  assert.deepEqual(store.getDraft().displays, draft.displays); assert.deepEqual(store.getHistory(), history);
  const oldHost = createWorkbenchSession({ store });
  store.setProfileAddress(`0x${'2'.repeat(40)}`);
  assert.throws(() => oldHost.saveWorkbench(createDefaultWorkbenchPresentation()), /no longer active/);
});
