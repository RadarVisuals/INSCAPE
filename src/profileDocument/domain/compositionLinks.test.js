import { mergeBackup } from '../../systemWorkflow/workspaceBackupMerge.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioComposition, currentStudioDraft } from '../../systemWorkflow/domain/studioComposition.js';
import { validCompositionArtwork as validComposition } from '../../composition/compositionEditorDocument.js';
import { validCompositionLinks } from './compositionLinks.js';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { createWorkbenchCollection, appendWorkbench, projectWorkbenchDraft } from '../../systemWorkflow/domain/workbenchCollection.js';
import { createArticle } from '../../text/domain/article.js';
import { canvasPublicationCandidates, buildCanvasPublication } from './canvasPublication.js';
import { assertValidProfileDocumentV9 } from './profileDocumentV9Validation.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { serializeWorkbenchBackup, parseWorkbenchBackup } from '../../systemWorkflow/workbenchBackup.js';
const profile = '0x' + '1'.repeat(40);
const source = (moduleId = 'text:story', canvasId = 'workbench:second') => ({ profileAddress: profile, canvasId, moduleId });
const link = () => ({ id: 'link:story', kind: 'source', source: source(), destination: null });
const withLink = () => {
  const draft = createEmptySystemWorkflowDraft(profile, { generateId: () => 'first' });
  draft.texts = [{ id: 'text:story', article: createArticle('Story'), visibility: 'PUBLIC' }];
  const record = appendWorkbench(createWorkbenchCollection(draft), 'workbench:second', 'Second canvas', currentStudioDraft(draft));
  const composition = createStudioComposition('bento');
  composition.links = [link()];
  composition.cells[0].content = link().id;
  const { version, ...content } = composition;
  const first = record.workbenches[0].content;
  content.texts = first.texts;
  content.workbench.texts = first.workbench.texts;
  content.artworkLayers.push(...first.artworkLayers);
  Object.assign(first, content);
  record.activeId = record.workbenches[0].id;
  return record;
};
const publish = (record, selectedIds, previousDocument = null, includeShared = true) => buildCanvasPublication({
  candidates: canvasPublicationCandidates({ record, assetRecords: [], profile: {} }), selectedIds, previousDocument, includeShared });

test('links validate exact bounded references and preserve unresolved local sources for repair', () => {
  const value = withLink().workbenches[0].content;
  assert.equal(validComposition(value), true);
  for (const mutate of [item => item.source.profileAddress = 'javascript:bad', item => item.source.extra = true,
    item => item.id = '__proto__', item => item.destination = { ...source(), destinationId: 'no' }]) {
    const invalid = structuredClone(value); mutate(invalid.links[0]); assert.equal(validComposition(invalid), false);
  }
  const missing = structuredClone(value); missing.links[0].source.canvasId = 'workbench:missing'; assert.equal(validComposition(missing), true);
  assert.equal(validCompositionLinks([link(), link()]), false);
});
test('assembled publication blocks missing/private sources without automatically publishing a canvas', () => {
  const record = withLink(), before = structuredClone(record);
  assert.throws(() => publish(record, ['workbench:main']), /Linked content/);
  assert.deepEqual(record, before);
  const publicDocument = publish(record, ['workbench:main', 'workbench:second']);
  assert.deepEqual(publicDocument.links, record.workbenches[0].content.links);
  record.workbenches[1].content.texts[0].visibility = 'PRIVATE';
  assert.throws(() => publish(record, ['workbench:second'], publicDocument, false), /Linked content/);
  // Retained public content remains the authority when its local revision is excluded.
  assert.deepEqual(publish(record, [], publicDocument).canvases, publicDocument.canvases);
  const corrupt = structuredClone(publicDocument); corrupt.links[0].source.profileAddress = '0x' + '2'.repeat(40);
  assert.throws(() => assertValidProfileDocumentV9(corrupt), /Linked content/);
});
test('publication rejects links to a retired Display controller', () => {
  const record = withLink(), composition = record.workbenches[0].content;
  composition.links[0] = { id: 'link:story', kind: 'scene', controller: source('display:primary'), sources: { 'grid:first': source() }, destination: null };
  assert.throws(() => publish(record, ['workbench:main', 'workbench:second']), /Invalid Studio cells or artwork/);
});
test('link edits use canonical save, undo, redo, quota failure, reload and private recovery', () => {
  const values = new Map(); let fail = false;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('full'); values.set(key, value); }, removeItem: key => values.delete(key) };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.equal(root.restoreBackup(withLink(), { expectedGeneration: root.getGeneration() }), true);
  const store = root.getWorkbenchScope(), original = store.getSnapshot();
  const edited = { ...original, links: [{ ...link(), source: source('text:missing') }] };
  const saveComposition = (scope, before, next) => {
    if (!scope.isCurrent() || !scope.commitCompletedOperation(next, { expectedGeneration: scope.getGeneration() }))
      throw Error('The composition changed or could not be saved.');
  };
  fail = true; assert.throws(() => saveComposition(store, original, edited), /could not be saved/);
  assert.deepEqual(store.getSnapshot(), original);
  fail = false; saveComposition(store, original, edited);
  assert.equal(store.undo(), true); assert.deepEqual(store.getSnapshot(), original);
  assert.equal(store.redo(), true); assert.deepEqual(store.getSnapshot(), edited);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getSnapshot(), edited);
  const backup = parseWorkbenchBackup(serializeWorkbenchBackup(root.getBackupSnapshot()), profile);
  assert.deepEqual(projectWorkbenchDraft(backup.draft), edited);
  const restored = createSystemWorkflowDraftStore({ profileAddress: profile, storage: { getItem: () => null, setItem: () => {} } });
  assert.equal(restored.restoreBackup(backup.draft, { expectedGeneration: restored.getGeneration() }), true);
  assert.deepEqual(restored.getSnapshot(), edited);
  store.release(); assert.throws(() => saveComposition(store, edited, original), /changed/);
});

test('Merge copies conflicting Studio sources and rewrites their imported cell links only', () => {
  const incoming = withLink();
  const local = structuredClone(incoming);
  local.workbenches[1].name = 'Local source';
  local.shared.reception = { broken: true };
  const original = structuredClone(local);
  const { workspace } = mergeBackup({ workbenches: local, library: null }, { workbenches: incoming, library: null });
  const works = workspace.workbenches.workbenches;
  const [originalWork, originalSource, importedWork, importedSource] = works;
  assert.equal(works.length, 4);
  assert.equal(originalWork.content.links[0].source.canvasId, originalSource.id);
  assert.equal(importedWork.content.links[0].source.canvasId, importedSource.id);
  assert.notEqual(importedSource.id, originalSource.id);
  assert.deepEqual(local, original);
  assert.equal(Object.hasOwn(workspace.workbenches.shared, 'reception'), false);
  const identical = mergeBackup({ workbenches: local, library: null }, { workbenches: original, library: null });
  assert.equal(identical.workspace.workbenches.workbenches.length, 2);
  assert.equal(Object.hasOwn(identical.workspace.workbenches.shared, 'reception'), false);
});
