import test from 'node:test';
import assert from 'node:assert/strict';
import { createReception, validReception } from './receptionPresentation.js';
import { validReceptionLinks } from './receptionLinks.js';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { createWorkbenchCollection, appendWorkbench } from '../../systemWorkflow/domain/workbenchCollection.js';
import { createArticle } from '../../text/domain/article.js';
import { canvasPublicationCandidates, buildCanvasPublication } from './canvasPublication.js';
import { assertValidProfileDocumentV9 } from './profileDocumentV9Validation.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { saveReception, placeReceptionLink } from '../../reception/receptionSession.js';
import { serializeWorkbenchBackup, parseWorkbenchBackup } from '../../systemWorkflow/workbenchBackup.js';
const profile = '0x' + '1'.repeat(40);
const source = (moduleId = 'text:story', canvasId = 'workbench:second') => ({ profileAddress: profile, canvasId, moduleId });
const link = () => ({ id: 'link:story', kind: 'source', source: source(), destination: null });
const withLink = () => {
  const draft = createEmptySystemWorkflowDraft(profile, { generateId: () => 'first' });
  draft.texts = [{ id: 'text:story', article: createArticle('Story'), visibility: 'PUBLIC' }];
  const record = appendWorkbench(createWorkbenchCollection(draft), 'workbench:second', 'Second canvas', draft);
  const reception = createReception(); record.shared.reception = placeReceptionLink(reception, reception.regions[0].id, link()); return record;
};
const publish = (record, selectedIds, previousDocument = null, includeShared = true) => buildCanvasPublication({
  candidates: canvasPublicationCandidates({ record, assetRecords: [], profile: {} }), selectedIds, previousDocument, includeShared });

test('links validate exact bounded references and preserve unresolved local sources for repair', () => {
  const value = withLink().shared.reception;
  assert.equal(validReception(value), true);
  for (const mutate of [item => item.source.profileAddress = 'javascript:bad', item => item.source.extra = true,
    item => item.id = '__proto__', item => item.destination = { ...source(), destinationId: 'no' }]) {
    const invalid = structuredClone(value); mutate(invalid.links[0]); assert.equal(validReception(invalid), false);
  }
  const missing = structuredClone(value); missing.links[0].source.canvasId = 'workbench:missing'; assert.equal(validReception(missing), true);
  assert.equal(validReceptionLinks([link(), link()]), false);
});
test('assembled publication blocks missing/private sources without automatically publishing a canvas', () => {
  const record = withLink(), before = structuredClone(record);
  assert.throws(() => publish(record, ['workbench:main']), /Linked content/);
  assert.deepEqual(record, before);
  const publicDocument = publish(record, ['workbench:main', 'workbench:second']);
  assert.deepEqual(publicDocument.reception, record.shared.reception);
  record.workbenches[1].content.texts[0].visibility = 'PRIVATE';
  assert.throws(() => publish(record, ['workbench:second'], publicDocument, false), /Linked content/);
  // Retained public content remains the authority when its local revision is excluded.
  assert.deepEqual(publish(record, [], publicDocument).canvases, publicDocument.canvases);
  const corrupt = structuredClone(publicDocument); corrupt.reception.links[0].source.profileAddress = '0x' + '2'.repeat(40);
  assert.throws(() => assertValidProfileDocumentV9(corrupt), /Linked content/);
});
test('every published controller scene needs a valid mapping, including retained canvas versions', () => {
  const record = withLink(), reception = record.shared.reception;
  reception.links[0] = { id: 'link:story', kind: 'scene', controller: source('display:primary'), sources: { 'grid:first': source() }, destination: null };
  const first = publish(record, ['workbench:main', 'workbench:second']);
  const content = record.workbenches[1].content;
  content.grids.push({ ...structuredClone(content.grids[0]), id: 'grid:next' });
  assert.throws(() => publish(record, ['workbench:second'], first), /every published Display scene/);
  assert.doesNotThrow(() => publish(record, [], first));
  reception.links[0].sources['grid:next'] = source();
  assert.doesNotThrow(() => publish(record, ['workbench:second'], first));
  content.grids.find(grid => grid.id === 'grid:next').visibility = 'PRIVATE';
  const withoutPrivate = publish(record, ['workbench:second'], first);
  assert.deepEqual(Object.keys(withoutPrivate.reception.links[0].sources), ['grid:first']);
  assert.ok(reception.links[0].sources['grid:next'], 'private mapping remains in the local draft');
});
test('link edits use canonical save, undo, redo, quota failure, reload and private recovery', () => {
  const values = new Map(); let fail = false;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('full'); values.set(key, value); }, removeItem: key => values.delete(key) };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.equal(root.restoreBackup(withLink(), { expectedGeneration: root.getGeneration() }), true);
  const store = root.acquireReceptionScope(), original = store.getSnapshot().reception;
  const edited = placeReceptionLink(original, original.regions[0].id, { ...link(), source: source('text:missing') });
  fail = true; assert.throws(() => saveReception(store, original, edited), /could not be saved/);
  assert.deepEqual(store.getSnapshot().reception, original);
  fail = false; saveReception(store, original, edited);
  assert.equal(store.undo(), true); assert.deepEqual(store.getSnapshot().reception, original);
  assert.equal(store.redo(), true); assert.deepEqual(store.getSnapshot().reception, edited);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getSnapshot().reception, edited);
  const backup = parseWorkbenchBackup(serializeWorkbenchBackup(root.getBackupSnapshot()), profile);
  assert.deepEqual(backup.draft.shared.reception, edited);
  const restored = createSystemWorkflowDraftStore({ profileAddress: profile, storage: { getItem: () => null, setItem: () => {} } });
  assert.equal(restored.restoreBackup(backup.draft, { expectedGeneration: restored.getGeneration() }), true);
  assert.deepEqual(restored.getSnapshot().reception, edited);
  store.release(); assert.throws(() => saveReception(store, edited, original), /changed/);
});
