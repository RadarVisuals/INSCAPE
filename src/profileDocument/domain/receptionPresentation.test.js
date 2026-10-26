import test from 'node:test';
import assert from 'node:assert/strict';
import { createReception, validReception, projectReception } from './receptionPresentation.js';
import { splitReception, mergeReception, canMergeReception, resizeReception, receptionDividers, moveReception } from '../../reception/receptionLayout.js';
import { saveReception, assignReceptionContent, addReceptionText, prepareReceptionImage, saveReceptionTextResult } from '../../reception/receptionSession.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { buildProfileDocumentV9, countProfileDocumentV9Assets } from './profileDocumentV9Builder.js';
import { assertValidProfileDocumentV9 } from './profileDocumentV9Validation.js';
import { reconcileOwnerDraftWithPublishedProfile } from '../storage/ownerDraftReconciliation.js';
import { createWorkbenchCollection, appendWorkbench } from '../../systemWorkflow/domain/workbenchCollection.js';
import { canvasPublicationCandidates, buildCanvasPublication } from './canvasPublication.js';
import { createArticle } from '../../text/domain/article.js';
import { createProfileDocumentV9AssetResolver } from './profileDocumentV9Asset.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets } from '../../public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
const profile = '0x' + '1'.repeat(40);
const asset = createProfileDocumentV9AssetResolver(assets, { compactContentReference: false })(assets[0].id);
function fixture() {
  const values = new Map(); let fail = false;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('full'); values.set(key, value); }, removeItem: key => values.delete(key) };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  const workbench = root.getWorkbenchScope(), store = root.acquireReceptionScope();
  return { root, workbench, store, storage, fail: value => { fail = value; } };
}
test('first content creation is one operation and a cancelled first Library choice writes nothing', async () => {
  const { root, store } = fixture(), initial = createReception(), before = root.getDraft();
  const request = prepareReceptionImage(store, undefined, initial.regions[0].id, initial);
  request.cancel();
  assert.equal(await request.choose({ ...assets[0], assetRecord: assets[0] }), false);
  assert.deepEqual(root.getDraft(), before); assert.equal(store.getHistory().undo, null);
  const id = addReceptionText(store, undefined, initial.regions[0].id, initial);
  assert.equal(root.getDraft().reception.regions[0].content, id);
  assert.ok(store.undo()); assert.deepEqual(root.getDraft(), before);
  assert.equal(store.getHistory().undo, null);
});
const publish = draft => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft, assetRecords: [] });
function sample() {
  let value = createReception(), first = value.regions[0].id;
  value = splitReception(value, first, 'x', 'region:right');
  value.imageModules = [{ id: 'image:one', name: 'Source artwork', visibility: 'PUBLIC', width: 800, height: 600,
    sides: [{ id: 'side:one', asset, crop: { x: .3, y: .5, zoom: 2 }, transform: { quarterTurns: 1, mirrorX: true, mirrorY: false } }] }];
  value.texts = [{ id: 'text:one', article: { ...createArticle(), title: 'A story' }, visibility: 'PUBLIC' }];
  value.regions[0].content = 'image:one'; value.regions[1].content = 'text:one';
  return value;
}
test('partition splits, resizes T junctions and merges non-siblings without losing a record', () => {
  let v = sample(), left = v.regions[0].id;
  v = splitReception(v, left, 'y', 'region:bottom-left');
  v = splitReception(v, 'region:right', 'y', 'region:bottom-right');
  assert.equal(validReception(v), true);
  assert.equal(canMergeReception(v.regions[0], v.regions[2]), true);
  assert.throws(() => mergeReception(v, left, 'region:right'), /Choose/);
  const retained = v.texts;
  v = mergeReception(v, left, 'region:right', 'image:one');
  assert.deepEqual(v.texts, retained);
  const divider = receptionDividers(v).find(d => d.axis === 'y');
  v = resizeReception(v, divider.id, 6500);
  assert.equal(v.regions.find(r => r.id === left).height, 6500);
  assert.ok(v.regions.filter(r => r.id !== left).every(r => r.y === 6500));
  v = assignReceptionContent(v, 'region:bottom-left', 'text:one');
  v = moveReception(v, left, 'region:bottom-left');
  assert.equal(v.regions.find(r => r.id === left).content, 'text:one');
  assert.equal(v.imageModules[0].sides[0].crop.zoom, 2);
  assert.equal(validReception(v), true);
  for (const corrupt of [x => x.regions[0].width++, x => x.mobile.pop(), x => x.regions.push(x.regions[0]), x => x.branding.theme = 'unknown']) {
    const bad = structuredClone(v); corrupt(bad); assert.equal(validReception(bad), false);
  }
});
test('Reception saves, isolated history, failures, reload and scope revocation preserve Workbench bytes', () => {
  const { root, store, storage, workbench, fail } = fixture(), before = root.getDraft();
  const value = sample(); saveReception(store, undefined, value);
  assert.equal(workbench.commitCompletedOperation(before, { expectedGeneration: workbench.getGeneration() }), false);
  assert.equal(store.commitCompletedOperation({ ...store.getSnapshot(), grids: [] }, { expectedGeneration: store.getGeneration() }), false);
  const saved = root.getDraft();
  const { reception, ...canvas } = saved; assert.deepEqual(canvas, before);
  fail(true); assert.throws(() => saveReception(store, store.getSnapshot().reception, { ...reception, radius: 44 }), /could not be saved/);
  assert.deepEqual(root.getDraft(), saved);
  fail(false); assert.ok(store.undo()); assert.deepEqual(root.getDraft(), before); assert.ok(store.redo());
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), saved);
  const backup = root.getBackupSnapshot();
  assert.ok(root.restoreBackup(backup, { expectedGeneration: root.getGeneration() }));
  assert.equal(store.isCurrent(), false);
  assert.equal(store.undo(), false);
  const current = root.acquireReceptionScope(); current.release();
  assert.equal(root.getWorkbenchScope().isCurrent(), true);
});
test('new Text uses canonical records, storage retry preserves unrelated region edits', () => {
  const { store, fail } = fixture(), value = createReception();
  saveReception(store, undefined, value);
  const id = addReceptionText(store, store.getSnapshot().reception, value.regions[0].id);
  const expected = store.getSnapshot().reception.texts.find(t => t.id === id);
  const article = { ...expected.article, title: 'Native text recovery' };
  fail(true);
  assert.equal(saveReceptionTextResult(store, { profile }, expected, article).saved, false);
  fail(false); saveReception(store, store.getSnapshot().reception, { ...store.getSnapshot().reception, radius: 48 });
  assert.equal(saveReceptionTextResult(store, { profile }, expected, article, { retry: true }).saved, true);
  assert.equal(store.getSnapshot().reception.radius, 48);
  assert.equal(store.getSnapshot().texts?.length || 0, 0);
  assert.equal(store.getSnapshot().reception.texts[0].article.title, article.title);
});
test('asynchronous Library choices cannot write after cancellation or scope change', async () => {
  const { root, store } = fixture(), value = createReception();
  saveReception(store, undefined, value);
  const input = { ...assets[0], assetRecord: assets[0] };
  const request = prepareReceptionImage(store, store.getSnapshot().reception, value.regions[0].id);
  request.cancel();
  assert.equal(await request.choose(input, { width: 800, height: 600, src: asset.media.url }), false);
  const another = prepareReceptionImage(store, store.getSnapshot().reception, value.regions[0].id);
  store.release();
  assert.equal(await another.choose(input, { width: 800, height: 600, src: asset.media.url }), false);
  assert.equal(root.getDraft().reception.imageModules.length, 0);
});
test('public round trip retains Reception geometry and source records, excludes private and unplaced material', () => {
  const { root, store } = fixture(), value = sample();
  value.texts[0].visibility = 'PRIVATE';
  value.texts.push({ id: 'text:unplaced', visibility: 'PUBLIC', article: { ...createArticle(), title: 'Unplaced secret' } });
  saveReception(store, undefined, value);
  const document = publish(root.getDraft());
  assertValidProfileDocumentV9(document);
  assert.equal(document.reception.regions[1].content, null);
  assert.equal(document.reception.texts.length, 0);
  assert.equal(document.reception.imageModules.length, 1);
  assert.equal(countProfileDocumentV9Assets(document), 1);
  assert.equal(JSON.stringify(document).includes('Unplaced secret'), false);
  assert.deepEqual(document.reception.imageModules[0].sides, value.imageModules[0].sides);
  const fresh = fixture(); fresh.store.release();
  assert.equal(reconcileOwnerDraftWithPublishedProfile({ document, profileAddress: profile, storage: fresh.storage, store: fresh.root }).status, 'HYDRATED_FROM_PUBLISHED');
  assert.deepEqual(projectReception(fresh.root.getDraft().reception), document.reception);
});
test('shared publication choice preserves unselected canvases and independently updates Reception', () => {
  const { root, store } = fixture(); saveReception(store, undefined, sample()); store.release();
  let record = createWorkbenchCollection(root.getDraft());
  record = appendWorkbench(record, 'workbench:second', 'Second', root.getDraft());
  const candidates = () => canvasPublicationCandidates({ record, assetRecords: [], profile: { name: 'Artist' } });
  const first = buildCanvasPublication({ candidates: candidates(), selectedIds: ['workbench:main', 'workbench:second'], includeShared: true });
  record.shared.reception.radius = 60;
  const selected = buildCanvasPublication({ candidates: candidates(), selectedIds: ['workbench:main'], includeShared: false, previousDocument: first });
  assert.deepEqual(selected.reception, first.reception); assert.deepEqual(selected.canvases, first.canvases);
  const shared = buildCanvasPublication({ candidates: candidates(), selectedIds: [], includeShared: true, previousDocument: selected });
  assert.equal(shared.reception.radius, 60);
  assert.deepEqual(shared.canvases, first.canvases); assert.deepEqual(shared.workbench, first.workbench);
});
