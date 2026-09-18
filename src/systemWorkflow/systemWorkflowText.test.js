import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { createSystemWorkflowAuthoringSession } from './systemWorkflowAuthoringSession.js';
import { createDisplayModuleSession, addDisplayModule } from './displayModuleSession.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { validateSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { validateProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { ownerSystemWorkflowPreviewEntryMediaUrls } from '../public/ownerSystemWorkflowPreviewDocument.js';
import { addArticleToDisplay, saveDisplayArticleResult } from '../text/textTransfer.js';
const profile = '0x' + '1'.repeat(40);
function fixture() {
  const values = new Map(); let fail = false;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('full'); values.set(key, value); } };
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  const session = createSystemWorkflowAuthoringSession({ store });
  const gridId = session.getState().selectedGridId;
  return { store, session, storage, gridId, fail: () => { fail = true; }, current: () => store.getDraft().grids.find(g => g.id === gridId).placements[0] };
}
test('legacy text layers reopen, publish and restore without asset references or read-time rewrites', () => {
  const f = fixture(); const old = f.store.getDraft(); const bytes = JSON.stringify(old);
  assert.equal(validateSystemWorkflowDraft(old).valid, true); assert.equal(JSON.stringify(old), bytes);
  // Stored compatibility fixture: do not keep a retired writer alive to create it.
  const legacy = f.store.getDraft();
  legacy.grids.find(g => g.id === f.gridId).placements.push({ id: 'placement:legacy-text', kind: 'text',
    text: { content: '//ARRIVAL', font: 'sora', size: 96, color: '#ffffff', alignment: 'left', bold: false, italic: false },
    column: 2, row: 2, columnSpan: 16, rowSpan: 4, layer: 0, navigationOrder: 0, visibility: 'PUBLIC', locked: false,
    transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } });
  assert.ok(f.store.commitCompletedOperation(legacy, { expectedGeneration: f.store.getGeneration() }));
  const draft = f.store.getDraft();
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage }).getDraft(), draft);
  const document = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft });
  assert.equal(validateProfileDocumentV9(document).valid, true);
  assert.equal(document.grids[0].placements[0].text.content, '//ARRIVAL');
  assert.equal(Object.hasOwn(document.grids[0].placements[0], 'asset'), false);
  assert.deepEqual(ownerSystemWorkflowPreviewEntryMediaUrls(document), []);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(document, draft).grids.find(g => g.id === f.gridId).placements[0], f.current());
  assert.ok(f.store.undo()); assert.equal(f.current(), undefined); assert.ok(f.store.redo());
  const privateDraft = structuredClone(draft); privateDraft.grids.find(g => g.id === f.gridId).placements[0].visibility = 'PRIVATE';
  assert.deepEqual(buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: privateDraft }).grids[0].placements, []);
});
test('text uses existing move, resize, duplicate, layer, lock and remove operations, rejecting stale and failed writes', () => {
  const f = fixture(); addArticleToDisplay(f.store, profile, { gridId: f.gridId });
  const request = () => ({ gridId: f.gridId, placementId: f.current().id, expectedPlacement: f.current() });
  const old = f.current();
  f.session.movePlacement({ ...request(), expectedStartGeometry: old, destination: { ...old, column: 3 } });
  assert.equal(f.current().column, 3);
  f.session.resizePlacement({ ...request(), corner: 'se', destination: { ...f.current(), columnSpan: 20, rowSpan: 5 } });
  assert.equal(f.current().columnSpan, 20);
  assert.ok(saveDisplayArticleResult(f.store, profile, { gridId: f.gridId, expected: f.current(), article: { ...old.text.article, title: 'Changed' } }).saved);
  assert.equal(saveDisplayArticleResult(f.store, profile, { gridId: f.gridId, expected: old, article: old.text.article }).reason, 'conflict');
  f.session.duplicatePlacement(request()); assert.equal(f.store.getDraft().grids.find(g => g.id === f.gridId).placements.length, 2);
  f.session.changePlacementLayer({ ...request(), expectedPlacements: f.store.getDraft().grids.find(g => g.id === f.gridId).placements, operation: 'FRONT' });
  assert.equal(f.current().layer, 1);
  f.session.setPlacementLocked({ ...request(), locked: true });
  assert.equal(saveDisplayArticleResult(f.store, profile, { gridId: f.gridId, expected: f.current(), article: old.text.article }).saved, false);
  f.session.setPlacementLocked({ ...request(), locked: false });
  f.session.removePlacement(request()); assert.equal(f.store.getDraft().grids.find(g => g.id === f.gridId).placements.length, 1);
  f.fail(); const before = f.store.getDraft(); assert.throws(() => addArticleToDisplay(f.store, profile, { gridId: f.gridId })); assert.deepEqual(f.store.getDraft(), before);
});
test('text edits remain scoped to their Display and reject unknown attributes and invalid styles', () => {
  const f = fixture(); const id = addDisplayModule(f.store); const session = createDisplayModuleSession(f.store, id);
  addArticleToDisplay(f.store, profile, { moduleId: id, gridId: session.getState().selectedGridId });
  assert.equal(f.store.getDraft().grids.flatMap(g => g.placements).length, 0);
  assert.equal(session.getState().draft.grids.flatMap(g => g.placements).length, 1);
  const publicDraft = f.store.getDraft(); publicDraft.displays[0].visibility = 'PUBLIC';
  const document = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: publicDraft });
  assert.equal(document.displays[0].grids[0].placements[0].kind, 'text');
  assert.equal(validateProfileDocumentV9(document).valid, true);
  addArticleToDisplay(f.store, profile, { gridId: f.gridId });
  for (const patch of [{ fontSize: 0 }, { fontSize: Infinity }, { color: 'url(bad)' }, { background: 'url(bad)' }, { opacity: 2 }]) {
    const before = f.store.getDraft(), article = f.current().text.article;
    assert.equal(saveDisplayArticleResult(f.store, profile, { gridId: f.gridId, expected: f.current(), article: { ...article, appearance: { ...article.appearance, ...patch } } }).saved, false);
    assert.deepEqual(f.store.getDraft(), before);
  }
  const bad = f.store.getDraft(); bad.grids.find(g => g.id === f.gridId).placements[0].stableAssetId = 'fabricated';
  assert.equal(validateSystemWorkflowDraft(bad).valid, false);
});
