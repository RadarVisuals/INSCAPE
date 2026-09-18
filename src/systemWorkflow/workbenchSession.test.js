import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { createWorkbenchSession } from './workbenchSession.js';
import { createDisplayModuleSession, addDisplayModule } from './displayModuleSession.js';
import { PRIMARY_DISPLAY_ID } from './domain/displayModules.js';
import { createDefaultWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';
const profile = `0x${'1'.repeat(40)}`;
test('both Display sessions expose only Display actions and host capture needs no primary Display', () => {
  const values = new Map(), storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  const secondary = addDisplayModule(store);
  for (const id of [PRIMARY_DISPLAY_ID, secondary]) {
    const session = createDisplayModuleSession(store, id);
    assert.equal(session.saveWorkbench, undefined); assert.equal(session.setIdentityConfiguration, undefined);
    assert.equal(session.getState().draft.displays, undefined);
    session.createGrid();
  }
  const draft = store.getDraft(); draft.grids = [];
  store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() });
  const history = store.getHistory();
  assert.equal(createWorkbenchSession({ store }).saveWorkbench(createDefaultWorkbenchPresentation()), true);
  assert.deepEqual(store.getDraft().displays, draft.displays); assert.deepEqual(store.getHistory(), history);
  const oldHost = createWorkbenchSession({ store });
  store.setProfileAddress(`0x${'2'.repeat(40)}`);
  assert.throws(() => oldHost.saveWorkbench(createDefaultWorkbenchPresentation()), /no longer active/);
});
