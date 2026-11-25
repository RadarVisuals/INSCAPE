import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioComposition } from '../systemWorkflow/domain/studioComposition.js';
import { validCompositionEditorDocument as validComposition } from './compositionEditorDocument.js';
import { createEmptySystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { createWorkbenchCollection, appendWorkbench } from '../systemWorkflow/domain/workbenchCollection.js';
import { canvasPublicationCandidates, buildCanvasPublication } from '../profileDocument/domain/canvasPublication.js';
import { assertValidProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { publishedPresentationSnapshot, resolvePresentationSource } from '../presentation/presentationSources.js';
import { serializeWorkbenchBackup, parseWorkbenchBackup, summarizeWorkbenchBackup } from '../systemWorkflow/workbenchBackup.js';
import { createArticle } from '../text/domain/article.js';

const profileAddress = '0x' + '1'.repeat(40);
function fixture() {
  const draft = createEmptySystemWorkflowDraft(profileAddress, { generateId: () => 'first' });
  draft.texts = [{ id: 'text:story', article: createArticle('Linked story'), visibility: 'PUBLIC' }];
  const collection = appendWorkbench(createWorkbenchCollection(draft), 'workbench:story', 'Story', draft);
  const old = createStudioComposition('bento');
  old.links = [{ id: 'link:story', kind: 'source', source: { profileAddress, canvasId: 'workbench:story', moduleId: 'text:story' }, destination: null }];
  old.cells[0].content = 'link:story';
  collection.workbenches[0].content.composition = old;
  collection.activeId = collection.workbenches[0].id;
  return collection;
}
const publish = (record, selectedIds, previousDocument = null) => buildCanvasPublication({
  candidates: canvasPublicationCandidates({ record, assetRecords: [], profile: {} }), selectedIds, previousDocument, includeShared: true,
});

test('native Composition retains linked sources through selective publication and validates the assembled document', () => {
  const record = fixture(), before = structuredClone(record);
  assert.throws(() => publish(record, ['workbench:main']), /Linked content/);
  assert.deepEqual(record, before);
  const document = publish(record, ['workbench:main', 'workbench:story']);
  assert.equal(document.composition.version, 3);
  assert.equal(validComposition(document.composition, true), true);
  assert.doesNotThrow(() => assertValidProfileDocumentV9(document));
  const snapshot = publishedPresentationSnapshot(document);
  assert.equal(resolvePresentationSource(snapshot, document.composition.links[0].source).article.title, 'Linked story');
  record.workbenches[1].content.texts[0].visibility = 'PRIVATE';
  assert.throws(() => publish(record, ['workbench:story'], document), /Linked content/);
  assert.equal(publish(record, [], document).composition.cells[0].content, 'link:story');
});

test('private native cells do not expose linked references in public Composition', () => {
  const record = fixture(), composition = record.workbenches[0].content.composition;
  composition.shapes.find(shape => shape.id === composition.cells[0].id).visibility = 'PRIVATE';
  const document = publish(record, ['workbench:main']);
  assert.equal(document.composition.cells.length, composition.cells.length - 1);
  assert.equal(document.composition.links.length, 0);
  assert.ok(record.workbenches[0].content.composition.cells.length > 0);
});

test('native Composition can be backed up with the real canvas collection and summarized', () => {
  const record = fixture();
  const restored = parseWorkbenchBackup(serializeWorkbenchBackup(record), profileAddress).draft;
  assert.deepEqual(restored, record);
  assert.match(summarizeWorkbenchBackup(restored), new RegExp(restored.workbenches[0].content.composition.cells.length + ' Bento cells'));
});

