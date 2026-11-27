import { projectCompositionEditorDocument as projectComposition } from '../../composition/compositionEditorDocument.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { createWorkbenchCollection, appendWorkbench } from '../../systemWorkflow/domain/workbenchCollection.js';
import { canvasPublicationCandidates, canvasPublicationChanges, buildCanvasPublication, buildGalleryRemoval, canReplaceInvalidPublication, resolvePublicationBaseline } from './canvasPublication.js';
import { createStudioComposition } from '../../systemWorkflow/domain/studioComposition.js';
import { createTextPresentation } from './workbenchPresentation.js';
import { createArticle } from '../../text/domain/article.js';
import { publishedCanvasEntries, publishedCompositionEntries, publishedCompositionDestinations, publicationViewDestination, canvasDocument, CANVAS_CONTENT_KEYS } from './publishedCanvases.js';
import { validateProfileDocumentV9, parseProfileDocumentV9Json } from './profileDocumentV9Validation.js';
import { canonicalSerializeProfileDocumentV9 } from './profileDocumentV9Serialization.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { openStudioWorkbench, reconcileOwnerDraftWithPublishedProfile } from '../storage/ownerDraftReconciliation.js';

const address = '0x' + '1'.repeat(40);
function fixture() {
  const draft = createEmptySystemWorkflowDraft(address, { generateId: () => 'first' });
  let record = createWorkbenchCollection(draft);
  record.workbenches[0].name = 'First canvas';
  record = appendWorkbench(record, 'workbench:second', 'Second canvas', draft);
  record = appendWorkbench(record, 'workbench:private', 'Never published', draft);
  return record;
}
function setComposition(entry, composition) {
  const { version, ...content } = composition;
  Object.assign(entry.content, content);
}
const project = record => canvasPublicationCandidates({ record, profile: { name: 'Artist' }, assetRecords: [] });
const publish = (record, selectedIds, previousDocument = null, includeShared = !previousDocument) => buildCanvasPublication({ candidates: project(record), selectedIds, previousDocument, includeShared, exportedAt: new Date('2026-10-26T12:00:00Z') });

test('confirmation uses the confirmed placements of the selected works, including shared-only and recovered publications', () => {
  const record = fixture();
  const [gallery, profile, both] = record.workbenches.map(item => item.id);
  const document = buildCanvasPublication({ candidates: project(record), selectedIds: [gallery, profile, both],
    placements: { [profile]: ['profile'], [both]: ['profile', 'gallery'] }, includeShared: true });
  assert.equal(publicationViewDestination(document, [gallery]), 'gallery');
  assert.equal(publicationViewDestination(document, [profile]), 'profile');
  assert.equal(publicationViewDestination(document, [both]), 'profile');
  assert.equal(publicationViewDestination(document, [profile, gallery]), 'gallery');
  assert.equal(publicationViewDestination(document, []), 'profile');
  assert.equal(publicationViewDestination(document), 'gallery');
});

test('Studio opens a published-only work and its linked source in one local save, preserving private drafts', () => {
  const record = fixture();
  const [, work, source] = record.workbenches;
  work.introduction = 'A linked study';
  work.thumbnailCrop = { x: 0.4, y: 0.6, zoom: 2 };
  for (const [entry, target] of [[work, source], [source, work]]) {
    const composition = createStudioComposition('bento');
    const text = 'text:caption';
    composition.texts.push({ id: text, visibility: 'PUBLIC', article: createArticle(entry.name) });
    composition.workbench.texts.push(createTextPresentation(text));
    composition.artworkLayers.push(text);
    composition.links = [{ id: 'link:caption', kind: 'source', destination: null,
      source: { profileAddress: address, canvasId: target.id, moduleId: text } }];
    composition.cells[0].content = 'link:caption';
    setComposition(entry, composition);
  }
  record.workbenches.push({ ...work, id: 'workbench:other', name: 'Another published work' });
  const resolution = { status: 'RESOLVED', document: publish(record, record.workbenches.map(item => item.id)) };
  const values = new Map();
  let writes = 0;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { writes++; values.set(key, value); } };
  const store = createSystemWorkflowDraftStore({ profileAddress: address, storage });
  const privateId = store.createWorkbench('My private work');
  const before = store.getBackupSnapshot();
  const write = storage.setItem;
  storage.setItem = () => { throw Error('Storage full'); };
  assert.equal(openStudioWorkbench(store, work.id, resolution), false);
  assert.deepEqual(store.getBackupSnapshot(), before);
  storage.setItem = write;
  assert.throws(() => openStudioWorkbench(store, work.id, { ...resolution, status: 'INVALID' }), /no editable canvas/);
  assert.throws(() => openStudioWorkbench(store, 'workbench:unknown', resolution), /no editable canvas/);
  const count = writes;
  assert.equal(openStudioWorkbench(store, work.id, resolution), true);
  assert.equal(writes, count + 1);
  const loaded = createSystemWorkflowDraftStore({ profileAddress: address, storage });
  assert.equal(loaded.getWorkbenchId(), work.id);
  const saved = loaded.getBackupSnapshot();
  assert.deepEqual(saved.shared, before.shared);
  assert.deepEqual(saved.workbenches.slice(0, 2), before.workbenches);
  assert.deepEqual(saved.workbenches.slice(2).map(item => item.id), [work.id, source.id]);
  assert.deepEqual(loaded.readWorkbench(work.id).draft.links, work.content.links);
  assert.deepEqual(loaded.readWorkbench(work.id).thumbnailCrop, work.thumbnailCrop);
  assert.equal(loaded.readWorkbench(work.id).introduction, work.introduction);
  assert.ok(loaded.renameWorkbench('Edited locally'));
  assert.ok(loaded.switchWorkbench(privateId));
  assert.ok(openStudioWorkbench(loaded, work.id, resolution));
  assert.equal(loaded.readWorkbench(work.id).name, 'Edited locally');
});

test('an invalid document can be replaced explicitly from selected local content without reading or retaining it', () => {
  const record = fixture(), before = structuredClone(record);
  const resolution = { status: 'INVALID', address, errorCode: 'INVALID_DOCUMENT', document: { untrusted: true, revision: 8 } };
  assert.equal(canReplaceInvalidPublication(resolution, address), true);
  assert.throws(() => resolvePublicationBaseline(resolution, address), /Confirm replacement/);
  const previousDocument = resolvePublicationBaseline(resolution, address, { replaceInvalid: true });
  assert.equal(previousDocument, null);
  const document = publish(record, ['workbench:second'], previousDocument);
  assert.equal(document.revision, 1);
  assert.deepEqual(publishedCanvasEntries(document).map(item => item.id), ['workbench:second']);
  assert.doesNotMatch(canonicalSerializeProfileDocumentV9(document), /Private scene|Never published|untrusted/);
  assert.deepEqual(parseProfileDocumentV9Json(canonicalSerializeProfileDocumentV9(document)), document);
  assert.deepEqual(record, before);
});

test('replacement consent cannot bypass pending reads, integrity failures or another profile', () => {
  const invalid = { status: 'INVALID', address, errorCode: 'INVALID_DOCUMENT' };
  for (const change of [{ status: 'LOADING' }, { status: 'ERROR' }, { status: 'STALE' }, { busy: true },
    { errorCode: 'HASH_MISMATCH' }, { errorCode: 'RPC_POINTER_CONFLICT' }, { address: '0x' + '2'.repeat(40) }, { address: undefined }]) {
    const resolution = { ...invalid, ...change };
    assert.equal(canReplaceInvalidPublication(resolution, address), false);
    assert.throws(() => resolvePublicationBaseline(resolution, address, { replaceInvalid: true }), /latest publication/);
  }
  const document = publish(fixture(), ['workbench:main', 'workbench:second']);
  assert.deepEqual(resolvePublicationBaseline({ status: 'RESOLVED', document }, address), document);
  assert.throws(() => resolvePublicationBaseline({ status: 'RESOLVED', document }, '0x' + '2'.repeat(40)), /belong to this profile/);
  assert.throws(() => resolvePublicationBaseline({ status: 'RESOLVED', document: { untrusted: true } }, address));
  assert.equal(resolvePublicationBaseline({ status: 'UNAVAILABLE' }, address), null);
});

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
    doc => { doc.canvases[0].content.miniApps = []; },
    doc => { doc.canvases[0].content.metadata = { worldCover: { grid: {} } }; },
    doc => { doc.canvases[0].content.appearance = { menuSurfaceId: 'mist' }; },
    doc => { doc.canvases[0].content.grids = []; },
    doc => { doc.canvases = Array.from({ length: 30 }, (_, i) => ({ ...doc.canvases[0], id: `workbench:extra-${i}` })); },
  ]) {
    const invalid = structuredClone(first); change(invalid);
    assert.equal(validateProfileDocumentV9(invalid).valid, false);
  }
  assert.equal(validateProfileDocumentV9(canvasDocument(first, first.canvases[0])).valid, true);
});

test('a fresh owner restores all public canvases; an existing local draft is never replaced', () => {
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const store = createSystemWorkflowDraftStore({ profileAddress: address, storage });
  const draft = createEmptySystemWorkflowDraft(address);
  let record = createWorkbenchCollection(draft);
  for (let i = 2; i <= 30; i++) record = appendWorkbench(record, `workbench:piece-${i}`, `Piece ${i}`, draft);
  const ids = record.workbenches.map(item => item.id);
  const document = parseProfileDocumentV9Json(canonicalSerializeProfileDocumentV9(publish(record, ids)));
  assert.equal(reconcileOwnerDraftWithPublishedProfile({ document, profileAddress: address, storage, store }).status, 'HYDRATED_FROM_PUBLISHED');
  assert.deepEqual(store.listWorkbenches().map(item => item.id), ids);
  assert.equal(store.listWorkbenches().at(-1).name, 'Piece 30');
  const before = store.getBackupSnapshot();
  document.canvas.name = 'Changed remotely';
  assert.equal(reconcileOwnerDraftWithPublishedProfile({ document, profileAddress: address, storage, store }).status, 'LOCAL_CHANGES_PRESERVED');
  assert.deepEqual(store.getBackupSnapshot(), before);
  store.dispose?.();
});

test('Gallery and Profile reference one published work and retain independent selections on republish', () => {
  const record = fixture();
  const ids = ['workbench:main', 'workbench:second'];
  const placements = { 'workbench:main': ['gallery', 'profile'], 'workbench:second': ['profile'] };
  const first = buildCanvasPublication({ candidates: project(record), selectedIds: ids, includeShared: true, placements });
  const shown = (document, target) => publishedCompositionEntries(document, target).map(item => item.id);
  assert.deepEqual(shown(first, 'gallery'), ['workbench:main']);
  assert.deepEqual(shown(first, 'profile'), ['workbench:main', 'workbench:second']);
  assert.equal(canvasPublicationChanges(project(record), first).filter(item => ids.includes(item.id)).some(item => item.changed), false);
  assert.deepEqual(parseProfileDocumentV9Json(canonicalSerializeProfileDocumentV9(first)), first);
  record.workbenches[1].name = 'Pending local edit';
  const changes = { 'workbench:main': ['profile'] };
  assert.equal(canvasPublicationChanges(project(record), first, changes).find(item => item.id === 'workbench:main').changed, true);
  const next = buildCanvasPublication({ candidates: project(record), selectedIds: ['workbench:main'], previousDocument: first, placements: changes });
  assert.deepEqual(next.canvases, first.canvases);
  assert.deepEqual(shown(next, 'gallery'), []);
  assert.deepEqual(shown(next, 'profile'), ['workbench:main', 'workbench:second']);
  assert.doesNotMatch(canonicalSerializeProfileDocumentV9(next), /Pending local edit/);
  const old = structuredClone(first);
  delete old.canvas.destinations; delete old.canvases[0].destinations;
  assert.deepEqual(shown(old, 'gallery'), ['workbench:main', 'workbench:second']);
  assert.deepEqual(shown(old, 'profile'), []);
  for (const document of [first, next, old]) {
    for (const entry of publishedCompositionEntries(document)) {
      assert.deepEqual(publishedCompositionDestinations(document, entry.id), entry.destinations);
    }
    assert.deepEqual(publishedCompositionDestinations(document, 'workbench:private'), []);
  }
  for (const invalid of [[], ['profile', 'profile'], ['editor'], false, null]) {
    const malformed = structuredClone(next); malformed.canvas.destinations = invalid;
    assert.equal(validateProfileDocumentV9(malformed).valid, false);
  }
  assert.throws(() => buildCanvasPublication({ candidates: project(record), selectedIds: ids, includeShared: true,
    placements: { 'workbench:main': [] } }), /Choose Gallery/);
});

test('named Studio composition survives publication and fresh restore with private layers excluded', () => {
  const record = fixture();
  const composition = createStudioComposition('bento');
  const free = { id: 'text:free', article: createArticle('Free title'), visibility: 'PUBLIC' };
  const member = { id: 'text:cell', article: createArticle('Cell caption'), visibility: 'PUBLIC' };
  const secret = { id: 'text:secret', article: createArticle('Private story'), visibility: 'PRIVATE' };
  for (const text of [free, member, secret]) {
    composition.texts.push(text);
    composition.artworkLayers.push(text.id);
    composition.workbench.texts.push(createTextPresentation(text.id));
  }
  composition.cells[0].members = [member.id];
  setComposition(record.workbenches[1], composition);
  const bytes = canonicalSerializeProfileDocumentV9(publish(record, ['workbench:main', 'workbench:second']));
  const doc = parseProfileDocumentV9Json(bytes);
  for (const content of [doc, doc.canvases[0].content]) {
    for (const key of ['grids', 'artboard', 'appearance', 'geometry']) assert.equal(Object.hasOwn(content, key), false);
  }
  assert.equal(canonicalSerializeProfileDocumentV9(doc), bytes);
  const partial = structuredClone(doc);
  partial.canvases[0].content.grids = [];
  assert.equal(validateProfileDocumentV9(partial).valid, false);
  const published = doc.canvases[0].content;
  assert.equal(Object.hasOwn(published, 'composition'), false);
  assert.equal(doc.version, 9);
  assert.deepEqual(published.texts.map(t => t.id), [free.id, member.id]);
  assert.deepEqual(published.cells[0].members, [member.id]);
  assert.equal(published.cells.length, composition.cells.length);
  assert.doesNotMatch(canonicalSerializeProfileDocumentV9(doc), /text:secret|Private story/);
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const store = createSystemWorkflowDraftStore({ profileAddress: address, storage });
  assert.equal(reconcileOwnerDraftWithPublishedProfile({ document: doc, profileAddress: address, store }).status, 'HYDRATED_FROM_PUBLISHED');
  const restored = store.readWorkbench('workbench:second').draft;
  assert.deepEqual(restored.texts.map(t => t.id), [free.id, member.id]);
  assert.deepEqual(restored.cells, published.cells);
});

test('named Bento sources resolve against selected and retained named works, including after hydration', () => {
  const record = fixture();
  const link = { id: 'link:title', kind: 'source', source: { profileAddress: address, canvasId: 'workbench:second', moduleId: 'text:title' }, destination: null };
  const linked = createStudioComposition('bento');
  linked.links = [link]; linked.cells[0].content = link.id;
  setComposition(record.workbenches[0], linked);
  const source = createStudioComposition('canvas');
  source.texts.push({ id: 'text:title', visibility: 'PUBLIC', article: createArticle('Title') });
  source.workbench.texts.push(createTextPresentation('text:title'));
  source.artworkLayers.push('text:title');
  setComposition(record.workbenches[1], source);
  assert.throws(() => publish(record, ['workbench:main']), /Linked content/);
  const first = publish(record, ['workbench:second']);
  const document = publish(record, ['workbench:main'], first);
  assert.deepEqual(document.canvases[0].content.links, [link]);
  assert.throws(() => buildGalleryRemoval(document, 'workbench:second'), /break published links in .*First canvas/);
  const both = buildCanvasPublication({ candidates: project(record), selectedIds: ['workbench:second'], previousDocument: document,
    placements: { 'workbench:second': ['profile', 'gallery'] } });
  const hidden = buildGalleryRemoval(both, 'workbench:second');
  assert.deepEqual(hidden.canvases, both.canvases);
  assert.deepEqual(publishedCanvasEntries(hidden).map(item => item.content), publishedCanvasEntries(both).map(item => item.content));
  assert.deepEqual(hidden.canvas.destinations, ['profile']);
  source.texts[0].visibility = 'PRIVATE';
  assert.throws(() => publish(record, ['workbench:second'], document), /Linked content/);
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const store = createSystemWorkflowDraftStore({ profileAddress: address, storage });
  assert.equal(reconcileOwnerDraftWithPublishedProfile({ document, profileAddress: address, store }).status, 'HYDRATED_FROM_PUBLISHED');
  assert.deepEqual(store.readWorkbench('workbench:main').draft.links, [link]);
});

test('removing Gallery from a work on both pages retains its full Profile composition', () => {
  const record = fixture();
  const ids = ['workbench:main', 'workbench:second'];
  const published = buildCanvasPublication({ candidates: project(record), includeShared: true, selectedIds: ids,
    placements: Object.fromEntries(ids.map(id => [id, ['gallery', 'profile']])) });
  for (const id of ids) {
    const original = structuredClone(published);
    const removed = buildGalleryRemoval(published, id, published.exportedAt);
    const expected = structuredClone(original);
    (id === expected.canvas.id ? expected.canvas : expected.canvases[0]).destinations = ['profile'];
    expected.revision++;
    assert.deepEqual(removed, expected);
    assert.deepEqual(published, original);
    assert.deepEqual(publishedCompositionEntries(removed, 'profile').map(item => item.id), ids);
    assert.throws(() => buildGalleryRemoval(removed, id), /no longer in the published Gallery/);
  }
});

test('physical removal handles primary and secondary works without altering retained works', () => {
  const record = fixture();
  setComposition(record.workbenches[0], createStudioComposition('bento'));
  const doc = buildCanvasPublication({ candidates: project(record), includeShared: true,
    selectedIds: ['workbench:main', 'workbench:second'], placements: {} });
  const [primary, second] = publishedCanvasEntries(doc);
  const original = structuredClone(doc);
  const removedPrimary = buildGalleryRemoval(doc, primary.id, doc.exportedAt);
  assert.deepEqual(publishedCanvasEntries(removedPrimary), [second]);
  assert.doesNotMatch(canonicalSerializeProfileDocumentV9(removedPrimary), /Removed source|First canvas/);
  assert.deepEqual(removedPrimary.identityPresentation, doc.identityPresentation);
  const removedSecondary = buildGalleryRemoval(doc, second.id);
  assert.deepEqual(publishedCanvasEntries(removedSecondary), [primary]);
  assert.deepEqual(buildGalleryRemoval(doc, primary.id, doc.exportedAt), removedPrimary);
  assert.deepEqual(doc, original);
});

test('removing the last work leaves an empty verified profile and supports a later publication', () => {
  const record = fixture();
  setComposition(record.workbenches[0], createStudioComposition('bento'));
  record.shared.identityPresentation.alias = 'Public identity';
  const named = publish(record, ['workbench:main']);
  const implicit = structuredClone(named);
  delete implicit.canvas; delete implicit.canvases;
  for (const doc of [named, implicit]) {
    const id = publishedCompositionEntries(doc, 'gallery')[0].id;
    const empty = buildGalleryRemoval(doc, id, doc.exportedAt);
    assert.equal(empty.canvas, null);
    assert.deepEqual(empty.canvases, []);
    assert.equal(Object.hasOwn(empty, 'grids'), false);
    assert.deepEqual(CANVAS_CONTENT_KEYS.filter(key => Object.hasOwn(empty, key)), []);
    assert.doesNotMatch(canonicalSerializeProfileDocumentV9(empty), /Public scene|First canvas/);
    assert.deepEqual(parseProfileDocumentV9Json(canonicalSerializeProfileDocumentV9(empty)), empty);
    assert.deepEqual(publishedCompositionEntries(empty), []);
    for (const key of ['profile', 'documentId', 'identityPresentation', 'createdAt', 'keeperDocks']) assert.deepEqual(empty[key], doc[key]);
    assert.equal(empty.revision, doc.revision + 1);
    assert.throws(() => buildGalleryRemoval(empty, id), /no longer in the published Gallery/);
    assert.throws(() => buildGalleryRemoval({ ...empty, revision: -1 }, id), /Revision/);
    for (const extra of [{ cells: record.workbenches[0].content.cells }, { grids: [] }, { canvases: [{ id }] }]) {
      assert.equal(validateProfileDocumentV9({ ...empty, ...extra }).valid, false);
    }
    const shared = buildCanvasPublication({ candidates: project(record), selectedIds: [], includeShared: true, previousDocument: empty });
    assert.deepEqual(publishedCompositionEntries(shared), []);
    const again = buildCanvasPublication({ candidates: project(record), selectedIds: ['workbench:second'], previousDocument: empty });
    assert.deepEqual(publishedCompositionEntries(again, 'gallery').map(item => item.id), ['workbench:second']);
    assert.deepEqual(publishedCompositionEntries(again, 'profile'), []);
  }
});

test('batch Gallery removal promotes the first surviving work and commits mixed placements in one revision', () => {
  const record = fixture();
  const [first, second, third] = record.workbenches.map(item => item.id);
  const ids = [first, second, third];
  const common = { candidates: project(record), includeShared: true, selectedIds: ids };
  const published = buildCanvasPublication({ ...common, placements: { [second]: ['gallery', 'profile'] } });
  const original = structuredClone(published);
  const remove = selection => buildGalleryRemoval(published, selection, published.exportedAt);
  const selection = [first, second];
  const result = remove(selection);
  assert.equal(result.revision, published.revision + 1);
  assert.deepEqual(result, remove([...selection].reverse()));
  assert.deepEqual(publishedCanvasEntries(result), [{ ...published.canvases[0], destinations: ['profile'] }, published.canvases[1]]);
  assert.deepEqual(publishedCompositionEntries(result, 'gallery').map(item => item.id), [third]);
  assert.deepEqual(publishedCompositionEntries(result, 'profile').map(item => item.id), [second]);
  assert.deepEqual(result.identityPresentation, published.identityPresentation);
  assert.deepEqual(result.profile, published.profile);
  assert.deepEqual(parseProfileDocumentV9Json(canonicalSerializeProfileDocumentV9(result)), result);
  for (const invalid of [[], [first, first], [second, 'workbench:missing']]) assert.throws(() => remove(invalid), /Select|selected work/);
  assert.throws(() => buildGalleryRemoval(result, [first, third]), /no longer in the published Gallery/);
  assert.deepEqual(published, original);

  const allGallery = buildCanvasPublication({ ...common, placements: {} });
  const empty = buildGalleryRemoval(allGallery, ids);
  assert.deepEqual(publishedCompositionEntries(empty), []);
  assert.equal(empty.revision, allGallery.revision + 1);
  assert.equal(Object.hasOwn(empty, 'grids'), false);
  assert.equal(empty.canvas, null);
  assert.equal(Object.hasOwn(empty, 'reception'), false);
});

test('mutually linked Gallery works can be removed together, and only surviving link owners block removal', () => {
  const record = fixture();
  const [first, second, third] = record.workbenches.map(item => item.id);
  function linkedTo(id) {
    const composition = createStudioComposition('bento');
    composition.links = [{ id: 'link:title', kind: 'source', source: { profileAddress: address, canvasId: id, moduleId: 'text:title' }, destination: null }];
    composition.cells[0].content = 'link:title';
    composition.texts.push({ id: 'text:title', visibility: 'PUBLIC', article: createArticle('Title') });
    composition.workbench.texts.push(createTextPresentation('text:title'));
    composition.artworkLayers.push('text:title');
    return composition;
  }
  setComposition(record.workbenches[0], linkedTo(second));
  setComposition(record.workbenches[1], linkedTo(first));
  const both = publish(record, [first, second]);
  assert.throws(() => buildGalleryRemoval(both, first), /break published links in .*Second canvas/);
  assert.throws(() => buildGalleryRemoval(both, second), /break published links in .*First canvas/);
  const empty = buildGalleryRemoval(both, [second, first]);
  assert.deepEqual(publishedCompositionEntries(empty), []);
  assert.equal(empty.revision, both.revision + 1);

  record.workbenches[2].name = 'Third canvas';
  setComposition(record.workbenches[2], linkedTo(first));
  const shared = publish(record, [third], both);
  const before = structuredClone(shared);
  assert.throws(() => buildGalleryRemoval(shared, [first, second]), error =>
    error.message.includes('Third canvas') && !/First canvas|Second canvas/.test(error.message));
  assert.deepEqual(shared, before);

  const dual = buildCanvasPublication({ candidates: project(record), selectedIds: [first], previousDocument: both,
    placements: { [first]: ['gallery', 'profile'] } });
  assert.throws(() => buildGalleryRemoval(dual, [first, second]), /break published links in .*First canvas/);
});

test('current v9 documents validate with optional Gallery destinations and Studio composition content', () => {
  const record = fixture();
  const [first, second] = record.workbenches.map(item => item.id);
  const modern = publish(record, [first, second]);
  const legacy = structuredClone(modern);
  delete legacy.canvas.destinations;
  delete legacy.canvases[0].destinations;
  const implicit = structuredClone(legacy);
  delete implicit.canvas;
  delete implicit.canvases;
  for (const compatible of [implicit, legacy]) {
    assert.equal(validateProfileDocumentV9(compatible).valid, true);
  }

  const native = projectComposition(createStudioComposition('canvas'));
  for (const change of [
    doc => { doc.canvas.destinations = ['gallery']; },
    doc => { doc.canvases[0].destinations = ['gallery']; },
    doc => { for (const key of CANVAS_CONTENT_KEYS) delete doc[key]; doc.composition = native; },
    doc => { doc.canvases[0].content = { composition: native }; },
  ]) {
    const updated = structuredClone(legacy);
    change(updated);
    assert.equal(validateProfileDocumentV9(updated).valid, true);
  }
  const empty = buildGalleryRemoval(legacy, [first, second]);
  assert.equal(empty.canvas, null);
  assert.equal(validateProfileDocumentV9(empty).valid, true);
});

test('publishing named compositions keeps Gallery and Profile independent of discarded local profile data', () => {
  const record = fixture();
  record.shared.reception = { corrupt: true };
  record.workbenches[0].name = 'The Last one';
  setComposition(record.workbenches[0], createStudioComposition('bento'));
  const candidates = project(record);
  assert.deepEqual(candidates.map(item => item.name), ['The Last one', 'Second canvas', 'Never published']);
  for (const destinations of [['gallery'], ['profile'], ['gallery', 'profile']]) {
    const document = buildCanvasPublication({ candidates, selectedIds: ['workbench:main'], includeShared: true,
      placements: { 'workbench:main': destinations } });
    assert.deepEqual(document.canvas.destinations, destinations);
    assert.doesNotMatch(JSON.stringify(document), /"reception(?:Destinations)?"/iu);
    for (const target of ['gallery', 'profile'])
      assert.deepEqual(publishedCompositionEntries(document, target).map(entry => entry.name), destinations.includes(target) ? ['The Last one'] : []);
  }
});
test('an existing signed ordinary Bento stays readable and a new revision emits only its artwork fields', () => {
  const record = fixture();
  setComposition(record.workbenches[0], createStudioComposition('bento'));
  const document = publish(record, ['workbench:main']);
  const composition = projectComposition(createStudioComposition('bento'));
  for (const key of CANVAS_CONTENT_KEYS) delete document[key];
  document.composition = composition;
  document.composition.branding = { name: '', logo: null };
  const bytes = JSON.stringify(document);
  const verified = parseProfileDocumentV9Json(bytes);
  const next = publish(record, ['workbench:second'], verified);
  assert.equal(JSON.stringify(verified), bytes);
  assert.equal(Object.hasOwn(next.composition, 'branding'), false);
  assert.deepEqual(next.composition.cells, verified.composition.cells);
});
