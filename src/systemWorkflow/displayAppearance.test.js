import assert from 'node:assert/strict';
import test from 'node:test';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { addDisplayModule, createDisplayModuleSession, setDisplayModuleFormat } from './displayModuleSession.js';
import { PRIMARY_DISPLAY_ID } from './domain/displayModules.js';
import { assertValidSystemWorkflowDraft, validateSystemWorkflowDraft, systemWorkflowPlacementSnapStep } from './domain/systemWorkflowDraft.js';
import { displayGuideMode } from './domain/displayAppearance.js';
import { createSystemWorkflowDropGeometry } from './systemWorkflowPlacement.js';
import { createSystemWorkflowMovementGesture, updateSystemWorkflowMovementGesture } from './systemWorkflowMovement.js';
import { createSystemWorkflowResizeGesture, updateSystemWorkflowResizeGesture } from './systemWorkflowResize.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { validateProfileDocumentV9, parseProfileDocumentV9Json } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { canonicalSerializeProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Serialization.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { createOwnerSystemWorkflowReviewStorage, OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE as profile, OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets } from '../public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';

const fixture = () => {
  const storage = createOwnerSystemWorkflowReviewStorage();
  return { storage, store: createSystemWorkflowDraftStore({ profileAddress: profile, storage }) };
};
const publish = draft => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft, assetRecords: assets });
const patch = { backgroundColor: '#274359', guideMode: 'DOTS', guideVisible: false, snapToGrid: false };

test('old draft and public appearance read without rewriting; malformed new fields are rejected', () => {
  const { store } = fixture(), draft = store.getDraft();
  const bytes = JSON.stringify(draft);
  assert.equal(JSON.stringify(assertValidSystemWorkflowDraft(draft)), bytes);
  assert.equal(systemWorkflowPlacementSnapStep(draft.appearance), 1);
  assert.equal(displayGuideMode({ ...draft.appearance, guideMode: 'NONE' }), 'NONE');
  const doc = publish(draft), publicBytes = canonicalSerializeProfileDocumentV9(doc);
  assert.equal(canonicalSerializeProfileDocumentV9(parseProfileDocumentV9Json(publicBytes)), publicBytes);
  for (const invalid of [{ backgroundColor: 'red' }, { backgroundColor: ['#123456'] }, { backgroundColor: '#123' }, { guideVisible: 1 }, { snapToGrid: null }, { unknown: true }]) {
    assert.equal(validateSystemWorkflowDraft({ ...draft, appearance: { ...draft.appearance, ...invalid } }).valid, false);
    assert.equal(validateProfileDocumentV9({ ...doc, appearance: { ...doc.appearance, ...invalid } }).valid, false);
  }
});

for (const primary of [true, false]) test(`${primary ? 'primary' : 'additional'} Display settings save atomically, undo, reload, publish and restore`, () => {
  const { store, storage } = fixture();
  const secondary = addDisplayModule(store), id = primary ? PRIMARY_DISPLAY_ID : secondary;
  const session = createDisplayModuleSession(store, id), before = store.getDraft(), initial = session.getState().draft;
  const write = storage.setItem;
  storage.setItem = () => { throw Error('full'); };
  assert.equal(setDisplayModuleFormat(store, id, { width: 24, height: 24 }, initial.geometry, patch, initial.appearance), false);
  assert.deepEqual(store.getDraft(), before);
  storage.setItem = write;
  assert.ok(setDisplayModuleFormat(store, id, { width: 24, height: 24 }, initial.geometry, patch, initial.appearance));
  const after = store.getDraft(), result = session.getState().draft;
  assert.deepEqual(result.appearance, { ...initial.appearance, ...patch });
  assert.deepEqual(result.grids, initial.grids);
  assert.deepEqual(primary ? after.displays : after.appearance, primary ? before.displays : before.appearance);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), after);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), before);
  assert.ok(store.redo()); assert.deepEqual(store.getDraft(), after);
  assert.throws(() => setDisplayModuleFormat(store, id, { width: 20, height: 20 }, result.geometry, { guideVisible: true }, initial.appearance), /changed/);
  after.displays[0].visibility = 'PUBLIC';
  const doc = parseProfileDocumentV9Json(canonicalSerializeProfileDocumentV9(publish(after)));
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(doc);
  assert.deepEqual(primary ? restored.appearance : restored.displays[0].appearance, result.appearance);
});

test('new Display settings are applied at creation, and preset colour resets remain valid', () => {
  for (const primary of [true, false]) {
    const { store } = fixture();
    if (primary) store.commitCompletedOperation({ ...store.getDraft(), grids: [] }, { expectedGeneration: store.getGeneration() });
    const before = store.getDraft(), id = addDisplayModule(store, { width: 27, height: 35 }, patch);
    const session = createDisplayModuleSession(store, id), created = session.getState().draft;
    assert.deepEqual(created.appearance, { ...before.appearance, ...patch });
    assert.ok(store.undo()); assert.deepEqual(store.getDraft(), before);
    assert.ok(store.redo());
    session.setAppearance({ expectedAppearance: created.appearance, appearance: { backgroundColor: null, surfaceId: 'carbon' } });
    assert.equal(session.getState().draft.appearance.backgroundColor, null);
  }
});

test('hidden guides still snap; disabling snap uses fine placement, move and resize precision', () => {
  const { store } = fixture(), original = store.getDraft();
  const record = { ...original.grids[0].placements[0], column: 2, row: 2, columnSpan: 4, rowSpan: 4 };
  const base = { ...original.appearance, guideSize: 0, guideMode: 'DOTS', guideVisible: false };
  const results = [];
  for (const snapToGrid of [true, false]) {
    const appearance = { ...base, snapToGrid };
    const field = { left: 0, top: 0, width: 320, height: 180, cellSize: 10, snapStep: systemWorkflowPlacementSnapStep(appearance) };
    assert.equal(displayGuideMode(appearance), 'NONE');
    assert.equal(displayGuideMode({ ...appearance, guideVisible: true }), 'DOTS');
    const move = updateSystemWorkflowMovementGesture(createSystemWorkflowMovementGesture(record, field, { x: 30, y: 30 }), { x: 43, y: 43 }, field, 0);
    const resize = updateSystemWorkflowResizeGesture(createSystemWorkflowResizeGesture(record, 'se', field, { x: 60, y: 60 }), { x: 73, y: 73 }, field, 0);
    const drop = createSystemWorkflowDropGeometry(3, 2, { x: 163, y: 93 }, field);
    results.push([move.previewGeometry.column, resize.previewGeometry.columnSpan, drop.column]);
  }
  assert.deepEqual(results[0], [3, 5, 10]);
  assert.deepEqual(results[1], [30 / 9, 48 / 9, 93 / 9]);
});
