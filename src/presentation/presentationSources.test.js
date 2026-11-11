import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptySystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { createWorkbenchCollection, appendWorkbench } from '../systemWorkflow/domain/workbenchCollection.js';
import { buildCanvasPublication, canvasPublicationCandidates } from '../profileDocument/domain/canvasPublication.js';
import { createArticle } from '../text/domain/article.js';
import { publishedPresentationSnapshot, resolvePresentationSource, resolvePresentationDestination, resolveSceneBinding } from './presentationSources.js';
import { workbenchOverviewModel } from '../public/workbenchOverview/workbenchOverviewModel.js';
import { createDefaultWorkbenchPresentation, createTextPresentation } from '../profileDocument/domain/workbenchPresentation.js';

const profileAddress = '0x' + '1'.repeat(40);
function fixture() {
  const draft = createEmptySystemWorkflowDraft(profileAddress, { generateId: () => 'one' });
  const first = draft.grids[0].id;
  draft.grids.push({ ...structuredClone(draft.grids[0]), id: 'grid:two', title: 'Second' });
  draft.texts = [{ id: 'text:story', visibility: 'PUBLIC', article: createArticle('First'),
    sceneLink: { displayId: 'display:primary', gridId: first, passages: [{ gridId: 'grid:two', article: createArticle('Second') }] } },
    { id: 'text:static', visibility: 'PUBLIC', article: createArticle('Static') }];
  draft.workbench = { ...createDefaultWorkbenchPresentation(), texts: [createTextPresentation('text:story'), createTextPresentation('text:static', 1)] };
  draft.workbench.display.open = true;
  let record = createWorkbenchCollection(draft);
  record = appendWorkbench(record, 'workbench:other', 'Other canvas', draft);
  record = appendWorkbench(record, 'workbench:private', 'Private canvas', draft);
  return { draft, record, first };
}
function publish(record, selectedIds, previousDocument = null) {
  return buildCanvasPublication({ candidates: canvasPublicationCandidates({ record, assetRecords: [], profile: {} }),
    selectedIds, previousDocument, includeShared: !previousDocument });
}
const ref = (canvasId = 'workbench:main', moduleId = 'text:story') => ({ profileAddress, canvasId, moduleId });
test('references resolve only against the assembled public versions, including retained unselected canvases', () => {
  const { record } = fixture(), first = publish(record, ['workbench:main', 'workbench:other']);
  record.workbenches[1].content.texts[0].article.title = 'Private edit';
  const next = publish(record, ['workbench:main'], first), snapshot = publishedPresentationSnapshot(next);
  assert.equal(resolvePresentationSource(snapshot, ref('workbench:other')).article.title, 'First');
  assert.equal(resolvePresentationSource(snapshot, ref('workbench:private')).status, 'unavailable');
  assert.equal(resolvePresentationSource(snapshot, { ...ref(), profileAddress: '0x' + '2'.repeat(40) }).status, 'unavailable');
  assert.equal(resolvePresentationSource(snapshot, { ...ref(), gridId: 'grid:removed' }).status, 'unavailable');
  assert.equal(resolvePresentationDestination(snapshot, { ...ref(), destinationId: 'camera:missing' }).status, 'unavailable');
  assert.equal(resolvePresentationDestination(snapshot, ref()).status, 'ready');
});
test('selected scenes project content explicitly; thumbnails keep their starting view and static articles stay unchanged', () => {
  const { draft } = fixture(), before = structuredClone(draft);
  const thumbnail = workbenchOverviewModel(draft), active = workbenchOverviewModel(draft, new Map(), { 'display:primary': { gridId: 'grid:two' } });
  assert.equal(thumbnail.items.find(item => item.id === 'text:story').source.article.title, 'First');
  assert.equal(active.items.find(item => item.id === 'display:primary').source.grid.id, 'grid:two');
  assert.equal(active.items.find(item => item.id === 'text:story').source.article.title, 'Second');
  assert.equal(active.items.find(item => item.id === 'text:static').source.article.title, 'Static');
  assert.deepEqual(draft, before);
});
test('scene bindings use stable IDs and reject missing mappings, wrong canvas or publication sessions', () => {
  const { record, first } = fixture(), snapshot = publishedPresentationSnapshot(publish(record, ['workbench:main']));
  const binding = { controller: ref('workbench:main', 'display:primary'), sources: {
    [first]: { ...ref(), gridId: first }, 'grid:two': { ...ref(), gridId: 'grid:two' },
  } };
  const session = { scope: { profileAddress, canvasId: 'workbench:main', revision: snapshot.revision }, scenes: { 'display:primary': { gridId: 'grid:two' } } };
  assert.equal(resolveSceneBinding(snapshot, binding, session).article.title, 'Second');
  for (const scope of [{ ...session.scope, canvasId: 'workbench:other' }, { ...session.scope, revision: 'old' }])
    assert.equal(resolveSceneBinding(snapshot, binding, { ...session, scope }).status, 'unavailable');
  assert.equal(resolveSceneBinding(snapshot, { ...binding, sources: {} }, session).status, 'unavailable');
});
