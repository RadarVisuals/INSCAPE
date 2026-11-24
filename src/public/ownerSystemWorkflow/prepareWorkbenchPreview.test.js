import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudioComposition } from '../../systemWorkflow/domain/studioComposition.js';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { createWorkbenchCollection, appendWorkbench } from '../../systemWorkflow/domain/workbenchCollection.js';
import { canvasPublicationCandidates, buildCanvasPublication } from '../../profileDocument/domain/canvasPublication.js';
import { createDefaultWorkbenchPresentation, createTextPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { createArticle } from '../../text/domain/article.js';
import prepareWorkbenchPreview from './prepareWorkbenchPreview.js';

const profileAddress = '0x1111111111111111111111111111111111111111';
const activeWork = { id: 'workbench:study', name: 'Current study' };

function addCaption(document, id, title, visibility) {
  document.texts.push({ id, visibility, article: createArticle(title) });
  document.workbench.texts.push(createTextPresentation(id));
  document.artworkLayers.push(id);
}

function inputs(draft, composition) {
  return {
    current: () => true, activeWork, draft, composition, profileAddress,
    store: { getProfileAddress: () => profileAddress, getGeneration: () => 1 },
    workbench: composition?.workbench || draft.workbench, publicationProfile: { name: 'Maker' },
    library: { assetsById: new Map(), decodedDimensions: new Map(), records: [] },
  };
}

test('the selected composition preview filters unpublished layers and preserves the current draft and public artwork order', async () => {
  const draft = createEmptySystemWorkflowDraft(profileAddress);
  const composition = createStudioComposition('bento');
  addCaption(composition, 'text:first', 'First visible title', 'PUBLIC');
  addCaption(composition, 'text:private', 'Private title', 'PRIVATE');
  addCaption(composition, 'text:last', 'Last visible title', 'PUBLIC');
  const before = structuredClone(composition);
  const { entry, snapshot } = await prepareWorkbenchPreview(inputs(draft, composition));
  assert.equal(entry.id, activeWork.id);
  assert.equal(entry.name, activeWork.name);
  assert.deepEqual(snapshot.entries.map(item => item.id), [activeWork.id]);
  const shown = entry.draft.composition;
  assert.deepEqual(shown.cells.map(cell => cell.id), before.cells.map(cell => cell.id));
  assert.deepEqual(shown.artworkLayers, before.artworkLayers.filter(id => id !== 'text:private'));
  assert.deepEqual(shown.texts.map(text => text.article.title), ['First visible title', 'Last visible title']);
  assert.deepEqual(composition, before);
  composition.texts[0].article.title = 'Later edit';
  assert.equal(shown.texts[0].article.title, 'First visible title');
});

test('an obsolete composition preview request yields no preview', async () => {
  const draft = createEmptySystemWorkflowDraft(profileAddress);
  const composition = createStudioComposition('canvas');
  assert.equal(await prepareWorkbenchPreview({ ...inputs(draft, composition), current: () => false }), null);
});

test('linked sources come from the same profile publication and never from unselected local works', async () => {
  const draft = createEmptySystemWorkflowDraft(profileAddress);
  const composition = createStudioComposition('canvas');
  const sourceId = 'workbench:source';
  function publication(address) {
    const sharedDraft = createEmptySystemWorkflowDraft(address);
    let collection = createWorkbenchCollection(sharedDraft);
    collection = appendWorkbench(collection, sourceId, 'Published source', sharedDraft);
    collection = appendWorkbench(collection, 'workbench:unpublished', 'Unpublished source', sharedDraft);
    const candidates = canvasPublicationCandidates({ record: collection, profile: { name: 'Maker' }, assetRecords: [] });
    return buildCanvasPublication({ candidates, selectedIds: [sourceId], includeShared: true });
  }
  const scoped = await prepareWorkbenchPreview({ ...inputs(draft, composition), publishedDocument: publication(profileAddress) });
  assert.deepEqual(scoped.snapshot.entries.map(item => item.id).sort(), [sourceId, activeWork.id].sort());
  const other = await prepareWorkbenchPreview({ ...inputs(draft, composition), publishedDocument: publication('0x2222222222222222222222222222222222222222') });
  assert.deepEqual(other.snapshot.entries.map(item => item.id), [activeWork.id]);
});

test('a canvas without a cell document previews only its public writing, using the current local changes', async () => {
  const draft = createEmptySystemWorkflowDraft(profileAddress);
  draft.texts = [];
  draft.artworkLayers = [];
  draft.workbench = { ...createDefaultWorkbenchPresentation(), texts: [] };
  addCaption(draft, 'text:public', 'Edited title', 'PUBLIC');
  addCaption(draft, 'text:private', 'Hidden title', 'PRIVATE');
  const before = structuredClone(draft);
  const { entry } = await prepareWorkbenchPreview(inputs(draft));
  assert.equal(entry.id, activeWork.id);
  assert.deepEqual(entry.draft.texts.map(text => text.article.title), ['Edited title']);
  assert.deepEqual(draft, before);
});
