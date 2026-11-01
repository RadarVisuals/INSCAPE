import test from 'node:test';
import assert from 'node:assert/strict';
import { createReception, validReception } from '../profileDocument/domain/receptionPresentation.js';
import { createReceptionEditorDocument } from './receptionEditorDocument.js';
import { createEmptySystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { createWorkbenchCollection, appendWorkbench } from '../systemWorkflow/domain/workbenchCollection.js';
import { canvasPublicationCandidates, buildCanvasPublication } from '../profileDocument/domain/canvasPublication.js';
import { assertValidProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { publishedPresentationSnapshot, receptionDisplayAssetIds, resolvePresentationSource } from '../presentation/presentationSources.js';
import { serializeWorkbenchBackup, parseWorkbenchBackup, summarizeWorkbenchBackup } from '../systemWorkflow/workbenchBackup.js';
import { createArticle } from '../text/domain/article.js';

const profileAddress = '0x' + '1'.repeat(40);
function fixture() {
  const draft = createEmptySystemWorkflowDraft(profileAddress, { generateId: () => 'first' });
  draft.texts = [{ id: 'text:story', article: createArticle('Linked story'), visibility: 'PUBLIC' }];
  const collection = appendWorkbench(createWorkbenchCollection(draft), 'workbench:story', 'Story', draft);
  const old = createReception();
  old.links = [{ id: 'link:story', kind: 'source', source: { profileAddress, canvasId: 'workbench:story', moduleId: 'text:story' }, destination: null }];
  old.regions[0].content = 'link:story';
  collection.shared.reception = createReceptionEditorDocument(old);
  return collection;
}
const publish = (record, selectedIds, previousDocument = null) => buildCanvasPublication({
  candidates: canvasPublicationCandidates({ record, assetRecords: [], profile: {} }), selectedIds, previousDocument, includeShared: true,
});

test('native Reception retains linked sources through selective publication and validates the assembled document', () => {
  const record = fixture(), before = structuredClone(record);
  assert.throws(() => publish(record, ['workbench:main']), /Linked content/);
  assert.deepEqual(record, before);
  const document = publish(record, ['workbench:main', 'workbench:story']);
  assert.equal(document.reception.version, 3);
  assert.equal(validReception(document.reception, true), true);
  assert.doesNotThrow(() => assertValidProfileDocumentV9(document));
  const snapshot = publishedPresentationSnapshot(document);
  assert.equal(resolvePresentationSource(snapshot, document.reception.links[0].source).article.title, 'Linked story');
  assert.deepEqual(receptionDisplayAssetIds(snapshot, document.reception), []);
  record.workbenches[1].content.texts[0].visibility = 'PRIVATE';
  assert.throws(() => publish(record, ['workbench:story'], document), /Linked content/);
  assert.equal(publish(record, [], document).reception.cells[0].content, 'link:story');
});

test('private native cells do not expose linked references in public Reception', () => {
  const record = fixture(), reception = record.shared.reception;
  reception.shapes.find(shape => shape.id === reception.cells[0].id).visibility = 'PRIVATE';
  const document = publish(record, ['workbench:main']);
  assert.equal(document.reception.cells.length, 0);
  assert.equal(document.reception.links.length, 0);
  assert.equal(record.shared.reception.cells.length, 1);
});

test('native Reception can be backed up with the real canvas collection and summarized', () => {
  const record = fixture();
  const restored = parseWorkbenchBackup(serializeWorkbenchBackup(record), profileAddress).draft;
  assert.deepEqual(restored, record);
  assert.match(summarizeWorkbenchBackup(restored), /1 Reception cells/);
});
