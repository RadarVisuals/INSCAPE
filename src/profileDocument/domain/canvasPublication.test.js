import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { createWorkbenchCollection, appendWorkbench } from '../../systemWorkflow/domain/workbenchCollection.js';
import { canvasPublicationCandidates, canvasPublicationChanges, buildCanvasPublication } from './canvasPublication.js';
import { publishedCanvasEntries, canvasDocument } from './publishedCanvases.js';
import { validateProfileDocumentV9, parseProfileDocumentV9Json } from './profileDocumentV9Validation.js';
import { canonicalSerializeProfileDocumentV9 } from './profileDocumentV9Serialization.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { reconcileOwnerDraftWithPublishedProfile } from '../storage/ownerDraftReconciliation.js';

const address = '0x' + '1'.repeat(40);
function fixture() {
  const draft = createEmptySystemWorkflowDraft(address, { generateId: () => 'first' });
  draft.grids[0].title = 'Public scene';
  draft.grids.push({ ...structuredClone(draft.grids[0]), id: 'grid:private', title: 'Private scene', visibility: 'PRIVATE' });
  let record = createWorkbenchCollection(draft);
  record.workbenches[0].name = 'First canvas';
  record = appendWorkbench(record, 'workbench:second', 'Second canvas', draft);
  record = appendWorkbench(record, 'workbench:private', 'Never published', draft);
  return record;
}
const project = record => canvasPublicationCandidates({ record, profile: { name: 'Artist' }, assetRecords: [] });
const publish = (record, selectedIds, previousDocument = null, includeShared = !previousDocument) => buildCanvasPublication({ candidates: project(record), selectedIds, previousDocument, includeShared, exportedAt: new Date('2026-10-26T12:00:00Z') });

test('scoped publication publishes selected canvases only, retains unselected revisions and excludes private content', () => {
  const record = fixture(), before = structuredClone(record);
  const first = publish(record, ['workbench:main', 'workbench:second']);
  assert.deepEqual(record, before);
  assert.equal(publishedCanvasEntries(first).length, 2);
  assert.ok(!canonicalSerializeProfileDocumentV9(first).includes('Private scene'));
  assert.ok(!canonicalSerializeProfileDocumentV9(first).includes('Never published'));
  record.workbenches[0].name = 'Changed first';
  record.workbenches[1].name = 'Unpublished second edit';
  record.shared.identityPresentation.alias = 'Local identity edit';
  const next = publish(record, ['workbench:main'], first);
  assert.equal(next.canvas.name, 'Changed first');
  assert.deepEqual(next.canvases, first.canvases);
  assert.deepEqual(next.identityPresentation, first.identityPresentation);
  assert.equal(next.revision, 2);
  assert.deepEqual(parseProfileDocumentV9Json(canonicalSerializeProfileDocumentV9(next)), next);
  assert.equal(publish(record, [], next, true).identityPresentation.alias, 'Local identity edit');
  assert.equal(canvasPublicationChanges(project(record), next).find(item => item.id === 'workbench:second').changed, true);
  assert.equal(canvasPublicationChanges(project(record), next).find(item => item.id === 'workbench:main').changed, false);
});

test('publication rejects empty/unknown scope and invalid shared, nested, duplicate and private canvas records', () => {
  const record = fixture(), first = publish(record, ['workbench:main', 'workbench:second']);
  assert.throws(() => publish(record, [], first), /Select/);
  assert.throws(() => publish(record, ['workbench:missing']), /unavailable/);
  assert.throws(() => publish(record, ['workbench:main'], null, false), /profile details/);
  for (const change of [
    doc => { doc.canvases[0].id = doc.canvas.id; },
    doc => { doc.canvases[0].content.profile = { address }; },
    doc => { doc.canvases[0].content.canvases = []; },
    doc => { doc.canvases[0].content.appearance.menuSurfaceId = 'mist'; },
    doc => { doc.canvases[0].content.grids[0].visibility = 'PRIVATE'; },
    doc => { doc.canvases = Array.from({ length: 8 }, () => doc.canvases[0]); },
  ]) {
    const invalid = structuredClone(first); change(invalid);
    assert.equal(validateProfileDocumentV9(invalid).valid, false);
  }
  assert.equal(validateProfileDocumentV9(canvasDocument(first, first.canvases[0])).valid, true);
});

test('a fresh owner restores all public canvases; an existing local draft is never replaced', () => {
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const store = createSystemWorkflowDraftStore({ profileAddress: address, storage });
  const document = publish(fixture(), ['workbench:main', 'workbench:second']);
  assert.equal(reconcileOwnerDraftWithPublishedProfile({ document, profileAddress: address, storage, store }).status, 'HYDRATED_FROM_PUBLISHED');
  assert.deepEqual(store.listWorkbenches().map(item => item.name), ['First canvas', 'Second canvas']);
  const before = store.getBackupSnapshot();
  document.canvas.name = 'Changed remotely';
  assert.equal(reconcileOwnerDraftWithPublishedProfile({ document, profileAddress: address, storage, store }).status, 'LOCAL_CHANGES_PRESERVED');
  assert.deepEqual(store.getBackupSnapshot(), before);
  store.dispose?.();
});
