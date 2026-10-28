import test from 'node:test';
import assert from 'node:assert/strict';
import { createReception, validReception, projectReception } from './receptionPresentation.js';
import { splitReception, resizeReception, receptionDividers, reorderReception, deleteReceptionCell } from '../../reception/receptionLayout.js';
import { saveReception, addReceptionText, prepareReceptionImage, saveReceptionTextResult } from '../../reception/receptionSession.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { buildProfileDocumentV9, countProfileDocumentV9Assets } from './profileDocumentV9Builder.js';
import { assertValidProfileDocumentV9 } from './profileDocumentV9Validation.js';
import { reconcileOwnerDraftWithPublishedProfile } from '../storage/ownerDraftReconciliation.js';
import { createWorkbenchCollection, appendWorkbench } from '../../systemWorkflow/domain/workbenchCollection.js';
import { canvasPublicationCandidates, buildCanvasPublication } from './canvasPublication.js';
import { createArticle } from '../../text/domain/article.js';
import { createProfileDocumentV9AssetResolver } from './profileDocumentV9Asset.js';
import { validImageModules } from '../../imageModule/imageModule.js';
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
test('replacement discards orphaned Reception text, remains undoable and never changes Workbench data', () => {
  const { store, root } = fixture(), initial = createReception(), cell = initial.regions[0].id;
  const workbenches = structuredClone(root.getDraft().workbenches);
  for (let i = 0; i < 20; i++) {
    const expected = store.getSnapshot().reception;
    addReceptionText(store, expected, cell, expected || initial);
    assert.equal(store.getSnapshot().reception.texts.length, 1);
  }
  const value = store.getSnapshot().reception;
  assert.ok(store.undo()); assert.notEqual(store.getSnapshot().reception.texts[0].id, value.texts[0].id);
  assert.ok(store.redo()); assert.deepEqual(store.getSnapshot().reception, value);
  assert.deepEqual(root.getDraft().workbenches, workbenches);
});

test('Library replacement discards orphaned records, preserves source identity and protects a header logo', async () => {
  const { store } = fixture(), initial = createReception(), cell = initial.regions[0].id;
  await prepareReceptionImage(store, undefined, cell, initial).choose({ ...assets[0], assetRecord: assets[0] });
  let value = store.getSnapshot().reception;
  assert.deepEqual(value.imageModules[0].sides[0].crop, { x: .5, y: .5, zoom: 1 });
  assert.equal(value.regions[0].padding, 0);
  const original = structuredClone(value.imageModules[0]);
  await prepareReceptionImage(store, value, cell).choose({ ...assets[0], assetRecord: assets[0] });
  value = store.getSnapshot().reception;
  assert.notEqual(value.imageModules[0].id, original.id);
  assert.equal(value.imageModules.length, 1);
  assert.deepEqual(value.imageModules[0].sides[0].asset, original.sides[0].asset);
  const logo = value.imageModules[0];
  saveReception(store, value, { ...value, branding: { ...value.branding, logo: logo.id } });
  value = store.getSnapshot().reception;
  await prepareReceptionImage(store, value, cell).choose({ ...assets[0], assetRecord: assets[0] });
  value = store.getSnapshot().reception;
  assert.deepEqual(value.imageModules.find(item => item.id === logo.id), logo);
  assert.equal(value.imageModules.length, 2);
  const split = splitReception(value, cell, 'x', 'region:text');
  saveReception(store, value, split);
  addReceptionText(store, store.getSnapshot().reception, 'region:text');
  assert.equal(store.getSnapshot().reception.regions.find(r => r.id === 'region:text').padding, 24);
});
function sample() {
  let value = createReception(), first = value.regions[0].id;
  value = splitReception(value, first, 'x', 'region:right');
  value.imageModules = [{ id: 'image:one', name: 'Source artwork', visibility: 'PUBLIC', width: 800, height: 600,
    sides: [{ id: 'side:one', asset, crop: { x: .3, y: .5, zoom: 2 }, transform: { quarterTurns: 1, mirrorX: true, mirrorY: false } }] }];
  value.texts = [{ id: 'text:one', article: { ...createArticle(), title: 'A story' }, visibility: 'PUBLIC' }];
  value.regions[0].content = 'image:one'; value.regions[1].content = 'text:one';
  return value;
}
test('Reception zoom below fill survives storage, history and public round trip without widening Workbench crops', () => {
  const { root, store, storage } = fixture(), value = sample();
  const workbenches = structuredClone(root.getDraft().workbenches);
  saveReception(store, undefined, value);
  for (const zoom of [.1, .25, .75]) {
    const before = store.getSnapshot().reception, next = structuredClone(before);
    next.imageModules[0].sides[0].crop.zoom = zoom;
    assert.equal(validReception(next), true);
    assert.equal(validImageModules(next.imageModules), false, 'Workbench Images still require fill zoom');
    saveReception(store, before, next);
    assert.ok(store.undo()); assert.deepEqual(store.getSnapshot().reception, before);
    assert.ok(store.redo()); assert.deepEqual(store.getSnapshot().reception, next);
    const reloaded = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
    assert.deepEqual(reloaded.getDraft().reception, next);
    const document = publish(root.getDraft());
    assertValidProfileDocumentV9(document);
    assert.deepEqual(document.reception.imageModules[0].sides, next.imageModules[0].sides);
    const fresh = fixture(); fresh.store.release();
    assert.equal(reconcileOwnerDraftWithPublishedProfile({ document, profileAddress: profile, storage: fresh.storage, store: fresh.root }).status, 'HYDRATED_FROM_PUBLISHED');
    assert.deepEqual(projectReception(fresh.root.getDraft().reception), document.reception);
  }
  for (const zoom of [0, .09, 4.01, NaN]) {
    const invalid = structuredClone(value); invalid.imageModules[0].sides[0].crop.zoom = zoom;
    assert.equal(validReception(invalid), false);
    assert.equal(validReception(projectReception(invalid), true), false);
  }
  assert.deepEqual(root.getDraft().workbenches, workbenches);
});

test('partition splits and resizes T junctions without losing records or accepting invalid geometry', () => {
  let value = sample(), left = value.regions[0].id;
  value = splitReception(value, left, 'y', 'region:bottom-left');
  value = splitReception(value, 'region:right', 'y', 'region:bottom-right');
  assert.equal(validReception(value), true);
  const divider = receptionDividers(value).find(item => item.axis === 'y');
  value = resizeReception(value, divider.id, 6500);
  assert.equal(value.regions.find(item => item.id === left).height, 6500);
  assert.equal(value.regions.find(item => item.id === 'region:bottom-left').y, 6500);
  assert.equal(value.imageModules[0].sides[0].crop.zoom, 2);
  assert.equal(value.texts.length, 1);
  assert.equal(validReception(value), true);
  for (const corrupt of [item => item.regions[0].width++, item => item.mobile.pop(), item => item.regions.push(item.regions[0]), item => item.branding.theme = 'unknown']) {
    const bad = structuredClone(value); corrupt(bad); assert.equal(validReception(bad), false);
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


test('cell reordering moves identity, content and appearance and shifts intervening cells in one saved operation', () => {
  const { store } = fixture();
  let value = sample(), first = value.regions[0].id;
  value = splitReception(value, 'region:right', 'y', 'region:third');
  value.regions[0] = { ...value.regions[0], padding: 7, surface: '#223344', alignX: 'right' };
  saveReception(store, undefined, value);
  const reordered = reorderReception(value, first, 'region:third');
  assert.equal(validReception(reordered), true);
  assert.deepEqual(reordered.regions.map(cell => cell.id), ['region:right', 'region:third', first]);
  assert.equal(reordered.regions[2].content, value.regions[0].content);
  assert.equal(reordered.regions[2].padding, 7);
  assert.equal(reordered.regions[2].surface, '#223344');
  assert.deepEqual(reordered.mobile, value.mobile);
  saveReception(store, store.getSnapshot().reception, reordered);
  assert.ok(store.undo()); assert.deepEqual(store.getSnapshot().reception, value);
  assert.ok(store.redo()); assert.deepEqual(store.getSnapshot().reception, reordered);
  const mobile = reorderReception(reordered, first, 'region:right', 'mobile');
  assert.deepEqual(mobile.regions, reordered.regions);
  assert.equal(mobile.mobile[1].id, first);
});

test('cell deletion closes nested partitions, removes only local content, restores via undo and keeps a blank final cell', () => {
  const { store, root, fail } = fixture();
  let value = sample();
  value = splitReception(value, value.regions[0].id, 'y', 'region:lower');
  value = splitReception(value, 'region:lower', 'x', 'region:fourth');
  const workbenches = structuredClone(root.getDraft().workbenches);
  saveReception(store, undefined, value);
  for (const cell of value.regions) {
    const removed = deleteReceptionCell(value, cell.id);
    assert.equal(validReception(removed), true);
    assert.equal(removed.regions.length, value.regions.length - 1);
    assert.ok(!removed.regions.some(item => item.id === cell.id));
  }
  const target = value.regions.find(cell => cell.content === 'image:one');
  const deleted = deleteReceptionCell(value, target.id);
  assert.equal(deleted.imageModules.length, 0);
  fail(true); assert.throws(() => saveReception(store, store.getSnapshot().reception, deleted), /could not be saved/);
  assert.deepEqual(store.getSnapshot().reception, value);
  fail(false); saveReception(store, store.getSnapshot().reception, deleted);
  assert.ok(store.undo()); assert.deepEqual(store.getSnapshot().reception, value);
  assert.ok(store.redo());
  value = deleted;
  while (value.regions.length > 1) value = deleteReceptionCell(value, value.regions[0].id);
  value = deleteReceptionCell(value, value.regions[0].id);
  assert.equal(validReception(value), true);
  assert.equal(value.regions.length, 1); assert.equal(value.regions[0].content, null);
  assert.deepEqual(value.mobile, [{ id: value.regions[0].id, columns: 2, height: 320 }]);
  assert.equal(value.texts.length, 0); assert.equal(value.imageModules.length, 0);
  assert.deepEqual(root.getDraft().workbenches, workbenches);
});
