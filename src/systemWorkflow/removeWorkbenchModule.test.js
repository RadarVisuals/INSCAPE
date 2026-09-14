import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { removeWorkbenchModule } from './removeWorkbenchModule.js';
import { addDisplayModule } from './displayModuleSession.js';
import { PRIMARY_DISPLAY_ID, displayModuleIds } from './domain/displayModules.js';
import { addMirrorModule } from './mirrorModuleSession.js';
import { addMiniApp } from '../miniApps/miniAppSession.js';
import { openMobileModule } from '../mobile/mobileSession.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { ownerSystemWorkflowPreviewEntryMediaUrls } from '../public/ownerSystemWorkflowPreviewDocument.js';
import { createDefaultWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';
const profile = `0x${'1'.repeat(40)}`;
function fixture() {
  const entries = new Map(); let failed = false;
  const storage = { getItem: k => entries.get(k) ?? null, setItem: (k,v) => { if (failed) throw Error('Storage unavailable'); entries.set(k,v); } };
  return { store: createSystemWorkflowDraftStore({ profileAddress: profile, storage }), storage, fail: () => { failed = true; } };
}
test('delete every module, undo, persist empty desktop and recreate original Display', () => {
  const { store, storage } = fixture();
  const original = store.getDraft();
  addDisplayModule(store); addMirrorModule(store); addMiniApp(store, profile); openMobileModule(store);
  for (const [kind,key] of [['display','displays'],['mirror','animations'],['mini-app','miniApps'],['mobile','mobile']]) {
    const before = store.getDraft();
    const record = kind === 'mobile' ? before.mobile : before[key][0];
    assert.equal(removeWorkbenchModule(store, profile, kind, record), true);
    assert.ok(kind === 'mobile' ? !store.getDraft().mobile : !store.getDraft()[key].length);
    store.undo(); assert.deepEqual(store.getDraft(), before); store.redo();
  }
  assert.equal(removeWorkbenchModule(store, profile, 'display', { id: PRIMARY_DISPLAY_ID, grids: original.grids }), true);
  assert.deepEqual(displayModuleIds(store.getDraft()), []);
  const reopened = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.deepEqual(reopened.getDraft().grids, []);
  const document = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: reopened.getDraft(), assetRecords: [] });
  assert.deepEqual(document.grids, []);
  assert.deepEqual(ownerSystemWorkflowPreviewEntryMediaUrls(document), []);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(document).grids, []);
  store.undo(); assert.deepEqual(store.getDraft().grids, original.grids); store.redo();
  assert.equal(addDisplayModule(store, 'PORTRAIT'), PRIMARY_DISPLAY_ID);
  assert.equal(store.getDraft().geometry.columns, 18);
  assert.equal(store.getDraft().grids.length, 2);
});
test('deletion rejects obsolete context and failed persistence without losing content', () => {
  const { store, fail } = fixture(); addDisplayModule(store);
  const record = store.getDraft().displays[0];
  assert.equal(removeWorkbenchModule(store, `0x${'2'.repeat(40)}`, 'display', record), false);
  assert.equal(removeWorkbenchModule(store, profile, 'display', { ...record, visibility: 'PUBLIC' }), false);
  const before = store.getDraft(); fail();
  assert.equal(removeWorkbenchModule(store, profile, 'display', record), false);
  assert.deepEqual(store.getDraft(), before);
});
test('deleting additional Display removes only its saved arrangement and undo restores it', () => {
  const { store } = fixture(); const id = addDisplayModule(store);
  const workbench = createDefaultWorkbenchPresentation();
  workbench.displays = [{ id, ...structuredClone(workbench.display) }];
  store.commitCompletedOperation({ ...store.getDraft(), workbench }, { expectedGeneration: store.getGeneration() });
  const before = store.getDraft();
  assert.equal(removeWorkbenchModule(store, profile, 'display', before.displays[0]), true);
  assert.deepEqual(store.getDraft().workbench.displays, []);
  assert.deepEqual(store.getDraft().grids, before.grids);
  store.undo(); assert.deepEqual(store.getDraft(), before);
});
test('an additional public Display survives removal of the original and restoration', () => {
  const { store } = fixture(); addDisplayModule(store);
  const draft = store.getDraft(); draft.displays[0].visibility = 'PUBLIC';
  draft.displays[0].grids[0].visibility = 'PUBLIC';
  store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() });
  removeWorkbenchModule(store, profile, 'display', { id: PRIMARY_DISPLAY_ID, grids: draft.grids });
  const document = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: store.getDraft(), assetRecords: [] });
  assert.equal(document.displays.length, 1);
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(document);
  assert.deepEqual(restored.grids, []);
  assert.equal(restored.displays[0].id, draft.displays[0].id);
});
