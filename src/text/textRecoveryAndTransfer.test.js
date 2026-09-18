import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { addTextModule, saveTextModuleResult } from './textSession.js';
import { attachTextToDisplay, detachTextFromDisplay, saveDisplayArticleResult } from './textTransfer.js';
import { addDisplayModule } from '../systemWorkflow/displayModuleSession.js';
import { displayContent } from '../systemWorkflow/domain/displayModules.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
const profile = `0x${'1'.repeat(40)}`;
function setup() {
  const entries = new Map(); let broken = false;
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => { if (broken) throw Error('full'); entries.set(key, value); } };
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  addTextModule(store, profile);
  return { store, storage, entries, fail: value => { broken = value; }, record: store.getDraft().texts[0] };
}
const edited = record => ({ ...record, article: { ...record.article, title: 'Arrival', content: { type: 'doc', content: [
  { type: 'paragraph', attrs: { textAlign: 'justify-center' }, content: [{ type: 'text', text: 'The landscape remembers.', marks: [{ type: 'bold' }] }] },
] } } });
test('retry rebases unrelated persisted changes, retains their data, and undoes only recovered text', () => {
  const f = setup(), next = edited(f.record);
  const external = f.store.getDraft(); external.identityPresentation.alias = 'External edit';
  f.storage.setItem(systemWorkflowDraftKey(profile), JSON.stringify(external));
  assert.equal(saveTextModuleResult(f.store, profile, f.record, next).reason, 'changed');
  assert.equal(saveTextModuleResult(f.store, profile, f.record, next, { retry: true }).saved, true);
  assert.equal(f.store.getDraft().identityPresentation.alias, 'External edit');
  assert.equal(f.store.getDraft().texts[0].article.title, 'Arrival');
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft().texts[0], f.record);
  assert.equal(f.store.getDraft().identityPresentation.alias, 'External edit');
});
test('retry preserves conflicting text until explicit replacement and recovers transient storage failures', () => {
  const f = setup(), next = edited(f.record), external = f.store.getDraft(); external.texts[0].article.title = 'Elsewhere';
  f.storage.setItem(systemWorkflowDraftKey(profile), JSON.stringify(external));
  assert.equal(saveTextModuleResult(f.store, profile, f.record, next, { retry: true }).reason, 'conflict');
  assert.equal(JSON.parse(f.storage.getItem(systemWorkflowDraftKey(profile))).texts[0].article.title, 'Elsewhere');
  f.fail(true);
  assert.equal(saveTextModuleResult(f.store, profile, f.record, next, { retry: true, replace: true }).reason, 'write_failed');
  assert.deepEqual(f.store.getDraft().texts[0], f.record);
  f.fail(false);
  assert.equal(saveTextModuleResult(f.store, profile, f.record, next, { retry: true, replace: true }).saved, true);
  assert.equal(f.store.getDraft().texts[0].article.title, 'Arrival');
});
test('retry refuses corrupt or removed records without replacing them or updating local state', () => {
  for (const raw of ['broken', JSON.stringify({ ...setup().store.getDraft(), texts: [] })]) {
    const f = setup(); f.storage.setItem(systemWorkflowDraftKey(profile), raw);
    assert.equal(saveTextModuleResult(f.store, profile, f.record, edited(f.record), { retry: true }).saved, false);
    assert.equal(f.storage.getItem(systemWorkflowDraftKey(profile)), raw);
    assert.deepEqual(f.store.getDraft().texts[0], f.record);
  }
});
test('rich Text moves atomically into each Display and out again with formatting, appearance, publication, reload and undo', () => {
  for (const additional of [false, true]) {
    const f = setup(), moduleId = additional ? addDisplayModule(f.store) : 'display:primary';
    const next = edited(f.record); next.article.appearance = { ...next.article.appearance, background: '#123456', opacity: .4, frame: true, padding: { top: 0, right: 12, bottom: 16, left: 24 }, edges: { corners: [12, 0, 0, 12], shadow: true, grain: .2 } };
    assert.ok(saveTextModuleResult(f.store, profile, f.record, next).saved);
    const gridId = displayContent(f.store.getDraft(), moduleId).grids.find(grid => grid.visibility === 'PUBLIC').id;
    const request = { expected: next, moduleId, gridId, cellSize: 20, destination: { column: 2, row: 3, columnSpan: 16, rowSpan: 8 } };
    f.fail(true); assert.throws(() => attachTextToDisplay(f.store, profile, request)); assert.equal(f.store.getDraft().texts.length, 1);
    f.fail(false); const id = attachTextToDisplay(f.store, profile, request);
    assert.equal(f.store.getDraft().texts.length, 0);
    const placement = displayContent(f.store.getDraft(), moduleId).grids.find(grid => grid.id === gridId).placements.find(item => item.id === id);
    assert.deepEqual(placement.text.article.content, next.article.content); assert.equal(placement.text.article.appearance.scale, 1.5);
    assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft().texts[0], next); assert.ok(f.store.redo());
    const reopened = createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage });
    if (!additional) {
      const doc = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: reopened.getDraft(), assetRecords: [] });
      assert.deepEqual(doc.grids.flatMap(grid => grid.placements).find(item => item.id === id).text, placement.text);
      assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, reopened.getDraft()).grids.flatMap(grid => grid.placements).find(item => item.id === id).text, placement.text);
    }
    detachTextFromDisplay(f.store, profile, { moduleId, gridId, expected: placement, cellSize: 20, window: { left: 30, top: 50, width: 320, height: 180 } });
    assert.deepEqual(f.store.getDraft().texts[0].article, next.article);
    assert.ok(f.store.undo()); assert.equal(f.store.getDraft().texts.length, 0);
  }
});
test('embedded retry preserves external geometry; detaching preserves rotation and mirroring and rejects locked text', () => {
  const f = setup(), gridId = f.store.getDraft().grids.find(grid => grid.visibility === 'PUBLIC').id;
  const id = attachTextToDisplay(f.store, profile, { expected: f.record, gridId, cellSize: 30, destination: { column: 1, row: 1, columnSpan: 12, rowSpan: 6 } });
  const expected = f.store.getDraft().grids.find(grid => grid.id === gridId).placements.find(item => item.id === id);
  const external = f.store.getDraft(), changed = external.grids.find(grid => grid.id === gridId).placements.find(item => item.id === id);
  changed.column = 4; changed.transform = { quarterTurns: 1, mirrorX: true, mirrorY: false };
  f.storage.setItem(systemWorkflowDraftKey(profile), JSON.stringify(external));
  const result = saveDisplayArticleResult(f.store, profile, { gridId, expected, article: edited(f.record).article }, { retry: true });
  assert.ok(result.saved); assert.equal(result.record.column, 4);
  detachTextFromDisplay(f.store, profile, { gridId, expected: result.record, cellSize: 30, window: { left: 10, top: 10, width: 240, height: 360 } });
  const record = f.store.getDraft().texts[0]; assert.deepEqual(record.article.appearance.transform, changed.transform);
  const attachedId = attachTextToDisplay(f.store, profile, { gridId, expected: record, cellSize: 30, destination: { column: 1, row: 1, columnSpan: 6, rowSpan: 12 } });
  const draft = f.store.getDraft(), placement = draft.grids.find(grid => grid.id === gridId).placements.find(item => item.id === attachedId);
  assert.deepEqual(placement.transform, changed.transform);
  placement.locked = true; assert.ok(f.store.commitCompletedOperation(draft, { expectedGeneration: f.store.getGeneration() }));
  assert.throws(() => detachTextFromDisplay(f.store, profile, { gridId, expected: placement, cellSize: 30, window: { left: 10, top: 10, width: 240, height: 360 } }));
});
