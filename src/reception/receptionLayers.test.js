import test from 'node:test';
import assert from 'node:assert/strict';
import { createReception, validReception, projectReception, restoreReception } from '../profileDocument/domain/receptionPresentation.js';
import { promoteReceptionScene, addReceptionScenePlacement, changeReceptionScenePlacement,
  reorderReceptionScenePlacement, removeReceptionScenePlacement, receptionScenePlacements, resetReceptionScenePlacement } from './receptionLayers.js';
import { addReceptionText, addReceptionShape, prepareReceptionImage, saveReception, saveReceptionTextResult, assignReceptionContent } from '../../browser-tests/fixtures/reception-v2.js';
import { splitReception, deleteReceptionCell } from './receptionLayout.js';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { createArticle } from '../text/domain/article.js';
import { createProfileDocumentV9AssetResolver } from '../profileDocument/domain/profileDocumentV9Asset.js';
import { buildProfileDocumentV9, countProfileDocumentV9Assets } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { assertValidProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets } from '../public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { createSystemWorkflowMovementGesture, updateSystemWorkflowMovementGesture } from '../systemWorkflow/systemWorkflowMovement.js';
import { projectSystemWorkflowViewport } from '../systemWorkflow/systemWorkflowViewportProjection.js';
import { addReceptionFrame, coupleReceptionFrames, changeReceptionGroup } from './receptionArrangement.js';
import { createWorkbenchCollection } from '../systemWorkflow/domain/workbenchCollection.js';
import { canvasPublicationCandidates, buildCanvasPublication } from '../profileDocument/domain/canvasPublication.js';
import { reconcileOwnerDraftWithPublishedProfile } from '../profileDocument/storage/ownerDraftReconciliation.js';
import { createProfileDraftReader } from '../systemWorkflow/profileDraftReader.js';

const profile = '0x' + '3'.repeat(40);
const asset = createProfileDocumentV9AssetResolver(assets, { compactContentReference: false })(assets[0].id);
function fixture() {
  const data = new Map(); let fail = false;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => {
    if (fail) throw Error('full'); data.set(key, value);
  }, removeItem: key => data.delete(key) };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage }), store = root.acquireReceptionScope();
  return { root, store, storage, fail: value => { fail = value; } };
}
function sample() {
  const value = createReception();
  value.imageModules = [{ id: 'image:backdrop', name: 'Source artwork', visibility: 'PUBLIC', width: 800, height: 600,
    sides: [{ id: 'side:backdrop', asset, crop: { x: .2, y: .6, zoom: .75 }, transform: { quarterTurns: 1, mirrorX: true, mirrorY: false } }] }];
  value.texts = [{ id: 'text:caption', article: { ...createArticle(), title: 'Foreground caption' }, visibility: 'PUBLIC' }];
  value.regions[0].content = 'image:backdrop'; value.regions[0].padding = 0;
  return value;
}
function layered() {
  const value = sample();
  return addReceptionScenePlacement(value, value.regions[0].id, 'text:caption');
}

test('adding the first layer promotes the original image without copying or changing its source or crop', () => {
  const value = sample(), before = structuredClone(value), id = value.regions[0].id;
  const next = addReceptionScenePlacement(value, id, 'text:caption');
  assert.deepEqual(value, before);
  assert.equal(validReception(next), true);
  assert.equal(next.regions[0].content, null);
  assert.deepEqual(next.regions[0].scene.geometry, { columns: 32, rows: 18 });
  assert.deepEqual(next.regions[0].scene.placements[0], {
    id: 'image:backdrop', column: 0, row: 0, columnSpan: 32, rowSpan: 18, locked: false,
  });
  assert.deepEqual(next.regions[0].scene.placements.map(item => item.id), ['image:backdrop', 'text:caption']);
  assert.equal(next.imageModules, value.imageModules);
  assert.equal(next.texts, value.texts);
  assert.equal(promoteReceptionScene(next, id), next);
  const linked = { ...value, regions: [{ ...value.regions[0], content: 'profile' }] };
  assert.throws(() => promoteReceptionScene(linked, id), /empty, Image or Text/);
});

test('scene validation rejects foreign, repeated, duplicate-owner and malformed placements', () => {
  const source = layered();
  for (const corrupt of [
    scene => scene.placements[0].id = 'profile',
    scene => scene.placements.push(scene.placements[0]),
    scene => scene.placements[0].column = -1,
    scene => scene.placements[0].columnSpan = 33,
    scene => scene.placements[0].rowSpan = NaN,
    scene => scene.placements[0].locked = 'yes',
    scene => scene.placements[0].layer = 1,
    scene => scene.geometry.columns = 0,
    scene => scene.geometry.rows = 513,
  ]) {
    const value = structuredClone(source); corrupt(value.regions[0].scene); assert.equal(validReception(value), false);
  }
  const duplicate = splitReception(source, source.regions[0].id, 'x', 'region:other');
  duplicate.regions[1].content = 'text:caption';
  assert.equal(validReception(duplicate), false);
  const ambiguous = structuredClone(source); ambiguous.regions[0].content = 'image:backdrop';
  assert.equal(validReception(ambiguous), false);
});

test('geometry, locking, order and removal preserve other layers and enforce the cell boundary', () => {
  const value = layered(), id = value.regions[0].id;
  let moved = changeReceptionScenePlacement(value, id, 'text:caption', { column: 8, row: 9, columnSpan: 20, rowSpan: 6 });
  assert.equal(validReception(moved), true);
  assert.deepEqual(moved.regions[0].scene.placements[0], value.regions[0].scene.placements[0]);
  assert.throws(() => changeReceptionScenePlacement(moved, id, 'text:caption', { column: 30 }), /inside/);
  assert.throws(() => changeReceptionScenePlacement(moved, id, 'text:caption', { id: 'text:replacement' }), /position/);
  moved = changeReceptionScenePlacement(moved, id, 'text:caption', { locked: true });
  assert.throws(() => changeReceptionScenePlacement(moved, id, 'text:caption', { row: 1 }), /Unlock/);
  assert.throws(() => reorderReceptionScenePlacement(moved, id, 'text:caption', 'back'), /Unlock/);
  assert.throws(() => removeReceptionScenePlacement(moved, id, 'text:caption'), /Unlock/);
  moved = changeReceptionScenePlacement(moved, id, 'text:caption', { locked: false });
  const ordered = reorderReceptionScenePlacement(moved, id, 'text:caption', 'back');
  assert.deepEqual(ordered.regions[0].scene.placements.map(item => item.id), ['text:caption', 'image:backdrop']);
  const removed = removeReceptionScenePlacement(ordered, id, 'text:caption');
  assert.equal(removed.texts.length, 0); assert.equal(removed.imageModules.length, 1);
  assert.equal(validReception(removed), true);
});

test('cell splitting and deletion do not clone layers or prune another cell\'s content', () => {
  const value = layered(), id = value.regions[0].id;
  const split = splitReception(value, id, 'x', 'region:other');
  assert.equal(Object.hasOwn(split.regions[1], 'scene'), false);
  assert.equal(split.regions[1].content, null);
  const kept = deleteReceptionCell(split, 'region:other');
  assert.deepEqual(kept.imageModules, value.imageModules); assert.deepEqual(kept.texts, value.texts);
  assert.equal(kept.regions[0].scene.placements.length, 2);
  const deleted = deleteReceptionCell(split, id);
  assert.equal(deleted.imageModules.length, 0); assert.equal(deleted.texts.length, 0);
  const empty = deleteReceptionCell(kept, id);
  assert.equal(Object.hasOwn(empty.regions[0], 'scene'), false);
  assert.equal(empty.imageModules.length, 0); assert.equal(validReception(empty), true);
  const branded = { ...kept, branding: { ...kept.branding, logo: 'image:backdrop' } };
  const removed = removeReceptionScenePlacement(branded, id, 'image:backdrop');
  assert.equal(removed.imageModules.length, 1, 'The independently used header logo is retained');
  const replacement = assignReceptionContent(split, 'region:other', 'profile');
  assert.deepEqual(replacement.regions[0].scene, split.regions[0].scene);
  assert.deepEqual(replacement.imageModules, split.imageModules);
});

test('additive Text and Image sessions save through Reception history, reload and native Text recovery', async () => {
  const { root, store, storage, fail } = fixture(), value = sample(), cell = value.regions[0].id;
  const originalCanvases = structuredClone(root.getDraft().workbenches);
  saveReception(store, undefined, value);
  const before = store.getSnapshot().reception;
  const textId = addReceptionText(store, before, cell, before, { layer: true });
  assert.equal(store.getSnapshot().reception.imageModules[0].id, 'image:backdrop');
  assert.equal(store.getSnapshot().reception.regions[0].scene.placements.at(-1).id, textId);
  const text = store.getSnapshot().reception.texts.find(item => item.id === textId);
  const article = { ...text.article, title: 'Saved layer article' };
  fail(true); assert.equal(saveReceptionTextResult(store, { profile }, text, article).saved, false);
  fail(false); assert.equal(saveReceptionTextResult(store, { profile }, text, article, { retry: true }).saved, true);
  const beforeImage = store.getSnapshot().reception;
  const imageId = await prepareReceptionImage(store, beforeImage, cell, beforeImage, { layer: true })
    .choose({ ...assets[0], assetRecord: assets[0] });
  const saved = store.getSnapshot().reception;
  assert.equal(saved.regions[0].scene.placements.at(-1).id, imageId);
  assert.deepEqual(saved.imageModules[0], before.imageModules[0]);
  assert.ok(store.undo()); assert.deepEqual(store.getSnapshot().reception, beforeImage);
  assert.ok(store.redo()); assert.deepEqual(store.getSnapshot().reception, saved);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft().reception, saved);
  assert.deepEqual(root.getDraft().workbenches, originalCanvases);
  const locked = changeReceptionScenePlacement(saved, cell, textId, { locked: true });
  fail(true); assert.throws(() => saveReception(store, store.getSnapshot().reception, locked), /could not be saved/);
  assert.deepEqual(store.getSnapshot().reception, saved);
});

test('obsolete, cancelled and revoked additive image requests cannot create layers', async () => {
  const { store } = fixture(), value = layered(), cell = value.regions[0].id;
  saveReception(store, undefined, value);
  const input = { ...assets[0], assetRecord: assets[0] };
  const request = () => prepareReceptionImage(store, store.getSnapshot().reception, cell, store.getSnapshot().reception, { layer: true });
  const cancelled = request(); cancelled.cancel(); assert.equal(await cancelled.choose(input), false);
  const stale = request();
  saveReception(store, store.getSnapshot().reception, { ...value, radius: 30 });
  assert.equal(await stale.choose(input), false);
  const revoked = request(); store.release(); assert.equal(await revoked.choose(input), false);
});

test('public projection retains ordered visible layers and embedded source records, and removes private placements', () => {
  const { root, store } = fixture(), value = layered();
  value.texts[0].visibility = 'PRIVATE';
  value.texts.push({ id: 'text:unplaced', visibility: 'PUBLIC', article: { ...createArticle(), title: 'Unplaced secret' } });
  saveReception(store, undefined, value);
  const document = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: root.getDraft(), assetRecords: [] });
  assertValidProfileDocumentV9(document);
  assert.equal(validReception(document.reception, true), true);
  assert.deepEqual(document.reception.regions[0].scene.placements, [value.regions[0].scene.placements[0]]);
  assert.equal(document.reception.texts.length, 0); assert.equal(countProfileDocumentV9Assets(document), 1);
  assert.equal(JSON.stringify(document).includes('Foreground caption'), false);
  assert.equal(JSON.stringify(document).includes('Unplaced secret'), false);
  assert.deepEqual(document.reception.imageModules[0].sides, value.imageModules[0].sides);
  assert.deepEqual(projectReception(restoreReception(document.reception)), document.reception);
});

test('native rectangle layers share shape appearance and survive save, history, public projection and restore', () => {
  const { root, store, storage } = fixture(), value = layered(), cell = value.regions[0].id;
  saveReception(store, undefined, value);
  const before = store.getSnapshot().reception;
  const id = addReceptionShape(store, before, cell);
  const added = store.getSnapshot().reception;
  assert.deepEqual(added.shapes[0], { id, name: 'Shape 1', color: '#101111', opacity: 1, visibility: 'PUBLIC' });
  assert.equal(added.regions[0].scene.placements.at(-1).id, id);
  assert.equal(root.getDraft().shapes?.length || 0, 0, 'Reception shapes do not become canvas shapes');
  assert.ok(store.undo()); assert.deepEqual(store.getSnapshot().reception, before);
  assert.ok(store.redo()); assert.deepEqual(store.getSnapshot().reception, added);
  const styled = { ...added, shapes: [{ ...added.shapes[0], color: '#456057', opacity: .6, grain: .2, blur: 2 }] };
  const arranged = reorderReceptionScenePlacement(styled, cell, id, 'back');
  saveReception(store, store.getSnapshot().reception, arranged);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft().reception, arranged);
  const document = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: root.getDraft(), assetRecords: [] });
  assertValidProfileDocumentV9(document);
  assert.equal(document.reception.regions[0].scene.placements[0].id, id);
  assert.deepEqual(document.reception.shapes[0], { id, name: 'Shape 1', color: '#456057', opacity: .6, grain: .2, blur: 2 });
  assert.deepEqual(projectReception(restoreReception(document.reception)), document.reception);
  assert.equal(countProfileDocumentV9Assets(document), 1);
  const removed = removeReceptionScenePlacement(arranged, cell, id);
  assert.deepEqual(removed.shapes, []); assert.equal(removed.imageModules.length, 1); assert.equal(removed.texts.length, 1);
  assert.deepEqual(deleteReceptionCell(arranged, cell).shapes, []);
});

test('private and unplaced shapes cannot leak; unsupported shape kinds and invalid appearances are rejected', () => {
  const { store } = fixture(), value = layered(), cell = value.regions[0].id;
  saveReception(store, undefined, value);
  const id = addReceptionShape(store, store.getSnapshot().reception, cell);
  const current = store.getSnapshot().reception;
  const hidden = { ...current, shapes: [{ ...current.shapes[0], visibility: 'PRIVATE' },
    { id: 'shape:unplaced', name: 'Unplaced secret', color: '#123456', opacity: 1, visibility: 'PUBLIC' }] };
  const projected = projectReception(hidden);
  assert.equal(validReception(projected, true), true); assert.deepEqual(projected.shapes, []);
  assert.equal(projected.regions[0].scene.placements.some(item => item.id === id), false);
  assert.equal(JSON.stringify(projected).includes('Unplaced secret'), false);
  for (const patch of [{ color: 'red' }, { opacity: 2 }, { blur: -1 }, { kind: 'grid', grid: { spacing: 24, lineWidth: 1 } }]) {
    const invalid = { ...current, shapes: [{ ...current.shapes[0], ...patch }] };
    assert.equal(validReception(invalid), false);
  }
  const duplicate = splitReception(current, cell, 'x', 'region:other');
  duplicate.regions[1].scene = structuredClone(duplicate.regions[0].scene);
  assert.equal(validReception(duplicate), false);
});

test('mobile layer placement persists independently of desktop and shares only content and locks', () => {
  const { root, store, storage } = fixture(), value = layered(), cell = value.regions[0].id;
  saveReception(store, undefined, value);
  const desktop = structuredClone(value.regions[0].scene.placements);
  let mobile = changeReceptionScenePlacement(value, cell, 'text:caption', { column: 2, row: 1, columnSpan: 28, rowSpan: 15 }, { mobile: true });
  assert.deepEqual(mobile.regions[0].scene.placements, desktop);
  assert.equal(validReception(mobile), true);
  assert.equal(receptionScenePlacements(mobile.regions[0].scene)[1].row, desktop[1].row);
  assert.deepEqual(receptionScenePlacements(mobile.regions[0].scene, true)[1], {
    id: 'text:caption', column: 2, row: 1, columnSpan: 28, rowSpan: 15, locked: false,
  });
  mobile = changeReceptionScenePlacement(mobile, cell, 'text:caption', { locked: true }, { mobile: true });
  assert.equal(receptionScenePlacements(mobile.regions[0].scene, false)[1].locked, true);
  assert.equal(Object.hasOwn(mobile.regions[0].scene.mobile[0], 'locked'), false);
  saveReception(store, store.getSnapshot().reception, mobile);
  const saved = store.getSnapshot().reception;
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft().reception, saved);
  assert.ok(store.undo()); assert.deepEqual(store.getSnapshot().reception, value);
  assert.ok(store.redo()); assert.deepEqual(store.getSnapshot().reception, saved);
  const document = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: root.getDraft(), assetRecords: [] });
  assertValidProfileDocumentV9(document);
  assert.deepEqual(document.reception.regions[0].scene.mobile, saved.regions[0].scene.mobile);
  assert.deepEqual(projectReception(restoreReception(document.reception)), document.reception);
  const unlocked = changeReceptionScenePlacement(saved, cell, 'text:caption', { locked: false });
  const reset = resetReceptionScenePlacement(unlocked, cell, 'text:caption');
  assert.deepEqual(receptionScenePlacements(reset.regions[0].scene, true), desktop);
  const hidden = { ...unlocked, texts: unlocked.texts.map(item => ({ ...item, visibility: 'PRIVATE' })) };
  assert.deepEqual(projectReception(hidden).regions[0].scene.mobile, []);
  assert.deepEqual(removeReceptionScenePlacement(unlocked, cell, 'text:caption').regions[0].scene.mobile, []);
});

test('mobile overrides reject duplicate, unknown, unbounded or content-carrying records', () => {
  const value = layered(), cell = value.regions[0].id;
  const base = changeReceptionScenePlacement(value, cell, 'text:caption', { row: 8, rowSpan: 10 }, { mobile: true });
  for (const corrupt of [
    mobile => mobile.push(mobile[0]), mobile => mobile[0].id = 'text:missing',
    mobile => mobile[0].row = 19, mobile => mobile[0].locked = true,
    mobile => mobile[0].article = createArticle(), mobile => delete mobile[0].columnSpan,
  ]) {
    const invalid = structuredClone(base); corrupt(invalid.regions[0].scene.mobile); assert.equal(validReception(invalid), false);
  }
});

test('Reception scene placements use Display precision and feed its movement geometry directly', () => {
  const value = layered(), cell = value.regions[0].id, original = value.regions[0].scene.placements[1];
  const field = projectSystemWorkflowViewport(value.regions[0].scene.geometry, { width: 960, height: 540 });
  const point = { x: original.column * field.cellSize + 10, y: original.row * field.cellSize + 10 };
  const gesture = createSystemWorkflowMovementGesture(original, field, point);
  const moved = updateSystemWorkflowMovementGesture(gesture, { x: point.x + 30, y: point.y + 30 }, field);
  const next = changeReceptionScenePlacement(value, cell, original.id, moved.previewGeometry);
  assert.equal(validReception(next), true);
  assert.equal(next.regions[0].scene.placements[1].column, original.column + 1);
  const slider = changeReceptionScenePlacement(next, cell, original.id, { column: 1.31, row: 2.25 });
  assert.equal(slider.regions[0].scene.placements[1].column, 12 / 9);
  assert.equal(slider.regions[0].scene.placements[1].row, 20 / 9);
});

test('layered free frames retain group spacing through deletion and roundtrip through selective publication and owner reads', () => {
  const { root, store, storage } = fixture(), initial = layered(), cell = initial.regions[0].id;
  saveReception(store, undefined, initial);
  const shapeId = addReceptionShape(store, store.getSnapshot().reception, cell);
  let value = changeReceptionScenePlacement(store.getSnapshot().reception, cell, shapeId, { column: 4, row: 9, columnSpan: 20, rowSpan: 8 }, { mobile: true });
  value = addReceptionFrame(value, { width: 1000, height: 900 }, 'region:middle');
  value = addReceptionFrame(value, { width: 1000, height: 900 }, 'region:last');
  value = coupleReceptionFrames(value, [cell, 'region:middle', 'region:last'], 'row', 'group:all');
  value = changeReceptionGroup(value, 'group:all', { gapX: 400 });
  value = deleteReceptionCell(value, 'region:middle');
  assert.equal(validReception(value), true);
  assert.deepEqual(value.arrangement.groups[0].members, [cell, 'region:last']);
  assert.equal(value.regions[1].x - value.regions[0].x - value.regions[0].width, 400);
  assert.equal(value.regions[0].scene.placements.length, 3);
  saveReception(store, store.getSnapshot().reception, value);
  const candidates = () => canvasPublicationCandidates({ record: createWorkbenchCollection(root.getDraft()), assetRecords: [], profile: { name: 'Artist' } });
  const first = buildCanvasPublication({ candidates: candidates(), selectedIds: ['workbench:main'], includeShared: true });
  assertValidProfileDocumentV9(first);
  assert.deepEqual(first.reception.regions[0].scene.mobile, value.regions[0].scene.mobile);
  assert.deepEqual(first.reception.arrangement, value.arrangement);
  const next = { ...value, shapes: value.shapes.map(item => ({ ...item, visibility: 'PRIVATE' })) };
  saveReception(store, store.getSnapshot().reception, next);
  const retained = buildCanvasPublication({ candidates: candidates(), selectedIds: ['workbench:main'], includeShared: false, previousDocument: first });
  assert.deepEqual(retained.reception, first.reception, 'Publishing a canvas does not publish pending Reception edits');
  const shared = buildCanvasPublication({ candidates: candidates(), selectedIds: [], includeShared: true, previousDocument: retained });
  assert.deepEqual(shared.reception.shapes, []); assert.deepEqual(shared.reception.regions[0].scene.mobile, []);
  assert.deepEqual(shared.reception.arrangement, value.arrangement);
  const reader = createProfileDraftReader({ profileAddress: profile, storage });
  assert.equal(reader.getSnapshot().status, 'valid');
  assert.deepEqual(reader.getSnapshot().draft.reception, next, 'The owner reader keeps the canonical local private content');
  const fresh = fixture(); fresh.store.release();
  assert.equal(reconcileOwnerDraftWithPublishedProfile({ document: shared, profileAddress: profile, storage: fresh.storage, store: fresh.root }).status, 'HYDRATED_FROM_PUBLISHED');
  assert.deepEqual(projectReception(fresh.root.getDraft().reception), shared.reception);
  assert.equal(reconcileOwnerDraftWithPublishedProfile({ document: shared, profileAddress: profile, storage, store: root }).status, 'LOCAL_CHANGES_PRESERVED');
  assert.deepEqual(root.getDraft().reception, next);
});
