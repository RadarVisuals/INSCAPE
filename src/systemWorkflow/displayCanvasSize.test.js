import assert from 'node:assert/strict';
import test from 'node:test';
import { displayFormat, displayPreset, isDisplayFormat, PRIMARY_DISPLAY_ID } from './domain/displayModules.js';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { addDisplayModule, createDisplayModuleSession, setDisplayModuleFormat } from './displayModuleSession.js';
import { createEmptySystemWorkflowDraft, assertValidSystemWorkflowDraft, validateSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { createNewDisplayPresentation, isValidWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { validateProfileDocumentV9, parseProfileDocumentV9Json } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { canonicalSerializeProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Serialization.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { addArticleToDisplay } from '../text/textTransfer.js';
import { createOwnerSystemWorkflowReviewStorage, OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE as profile, OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets } from '../public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';

function fixture() {
  const storage = createOwnerSystemWorkflowReviewStorage();
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  return { store, storage };
}
const publish = draft => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft, assetRecords: assets });

test('custom dimensions use existing geometry and canonical ratios; old formats retain exact bytes', () => {
  for (const size of [{ width: 24, height: 24 }, { width: 73, height: 19 }, { width: 512, height: 1 }, { width: 1, height: 512 }]) {
    const format = displayFormat(size);
    assert.ok(isDisplayFormat(format.artboard, format.geometry));
    assert.equal(displayPreset(format.geometry), 'CUSTOM');
    assertValidSystemWorkflowDraft({ ...createEmptySystemWorkflowDraft(profile), ...format });
  }
  for (const [preset, size] of [['LANDSCAPE', { width: 32, height: 18 }], ['PORTRAIT', { width: 18, height: 32 }]]) {
    assert.deepEqual(displayFormat(preset), displayFormat(size));
    const old = { ...createEmptySystemWorkflowDraft(profile), ...displayFormat(preset) };
    const bytes = JSON.stringify(old);
    assert.equal(JSON.stringify(assertValidSystemWorkflowDraft(old)), bytes);
    const publicBytes = canonicalSerializeProfileDocumentV9(publish(old));
    assert.equal(canonicalSerializeProfileDocumentV9(parseProfileDocumentV9Json(publicBytes)), publicBytes);
  }
  for (const bad of [0, -1, 1.5, 513, Infinity, NaN, '32', null]) {
    assert.throws(() => displayFormat({ width: bad, height: 18 }));
    assert.throws(() => displayFormat({ width: 32, height: bad }));
    const invalid = { ...createEmptySystemWorkflowDraft(profile), geometry: { columns: bad, rows: 18 } };
    assert.equal(validateSystemWorkflowDraft(invalid).valid, false);
  }
  assert.equal(isDisplayFormat({ aspectWidth: 16, aspectHeight: 9 }, { columns: 24, rows: 24 }), false);
  const invalidPublic = publish(createEmptySystemWorkflowDraft(profile));
  invalidPublic.geometry = { columns: 24, rows: 24 };
  assert.equal(validateProfileDocumentV9(invalidPublic).valid, false);
});

for (const primary of [true, false]) test(`custom ${primary ? 'primary' : 'additional'} Display creation saves, reloads and undoes`, () => {
  const { store, storage } = fixture();
  if (primary) store.commitCompletedOperation({ ...store.getDraft(), grids: [] }, { expectedGeneration: store.getGeneration() });
  const before = store.getDraft();
  const id = addDisplayModule(store, { width: 27, height: 35 });
  const draft = store.getDraft(), content = primary ? draft : draft.displays[0];
  assert.deepEqual(content.geometry, { columns: 27, rows: 35 });
  assert.equal(id === PRIMARY_DISPLAY_ID, primary);
  if (!primary) assert.deepEqual(draft.grids, before.grids);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), draft);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), before);
  assert.ok(store.redo()); assert.deepEqual(store.getDraft(), draft);
});

for (const primary of [true, false]) test(`resizing ${primary ? 'primary' : 'additional'} preserves all scenes, artwork and text; failure and stale forms are atomic`, () => {
  const { store, storage } = fixture();
  const secondary = addDisplayModule(store), id = primary ? PRIMARY_DISPLAY_ID : secondary;
  const session = createDisplayModuleSession(store, id);
  session.createGrid();
  addArticleToDisplay(store, profile, { moduleId: id, gridId: session.getState().draft.grids[0].id });
  const before = store.getDraft();
  const originalGeometry = session.getState().draft.geometry;
  assert.ok(setDisplayModuleFormat(store, id, { width: 12, height: 12 }, originalGeometry));
  const after = store.getDraft();
  const expected = structuredClone(before);
  Object.assign(primary ? expected : expected.displays[0], displayFormat({ width: 12, height: 12 }));
  assert.deepEqual(after, expected, 'dimensions are the only authored changes, including World Cover and sibling modules');
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), after);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), before);
  assert.ok(store.redo()); assert.deepEqual(store.getDraft(), after);
  const generation = store.getGeneration(), history = store.getHistory();
  assert.ok(setDisplayModuleFormat(store, id, { width: 12, height: 12 }));
  assert.equal(store.getGeneration(), generation);
  assert.throws(() => setDisplayModuleFormat(store, id, { width: 20, height: 20 }, originalGeometry), /changed/);
  const write = storage.setItem; storage.setItem = () => { throw Error('full'); };
  assert.equal(setDisplayModuleFormat(store, id, { width: 24, height: 24 }), false);
  assert.deepEqual(store.getDraft(), after); assert.deepEqual(store.getHistory(), history);
  storage.setItem = write;
  assert.ok(setDisplayModuleFormat(store, id, { width: 24, height: 24 }));
  assert.deepEqual(session.getState().draft.geometry, { columns: 24, rows: 24 }, 'same ratio with different dimensions is an edit');
});

test('public custom canvases clip fully outside layers, retain partial geometry and valid groups, and restore their dimensions', () => {
  const { store } = fixture();
  const id = addDisplayModule(store, { width: 40, height: 8 });
  setDisplayModuleFormat(store, PRIMARY_DISPLAY_ID, { width: 20, height: 20 });
  const draft = store.getDraft(), grid = draft.grids[0], first = grid.placements[0];
  grid.placements = [first, { ...first, id: 'partly-visible', column: 19, layer: 1, navigationOrder: 1 },
    { ...first, id: 'off-right', column: 20, layer: 2, navigationOrder: 2 },
    { ...first, id: 'off-left', column: -4, layer: 3, navigationOrder: 3 }];
  grid.groups = [{ id: 'group:test', placementIds: grid.placements.map(p => p.id) }];
  draft.displays[0].visibility = 'PUBLIC';
  draft.displays[0].grids[0].placements = [{ ...first, row: 7 }];
  draft.grids.find(g => g.id === 'grid:world-cover').placements = [{ ...structuredClone(first), id: 'cover-artwork' }];
  const saved = structuredClone(draft), doc = publish(draft);
  assert.deepEqual(draft, saved, 'publication must not prune the draft');
  assert.deepEqual(doc.geometry, { columns: 20, rows: 20 });
  assert.deepEqual(doc.grids[0].placements.map(p => p.id), [first.id, 'partly-visible']);
  assert.equal(doc.grids[0].placements[1].columnSpan, first.columnSpan);
  assert.deepEqual(doc.grids[0].groups[0].placementIds, [first.id, 'partly-visible']);
  assert.deepEqual(doc.displays[0].geometry, { columns: 40, rows: 8 });
  assert.equal(doc.displays[0].id, id);
  assert.equal(doc.metadata.worldCover.width / doc.metadata.worldCover.height, 16 / 9);
  const parsed = parseProfileDocumentV9Json(canonicalSerializeProfileDocumentV9(doc));
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(parsed);
  assert.deepEqual(restored.geometry, draft.geometry);
  assert.deepEqual(restored.displays[0].geometry, draft.displays[0].geometry);
  grid.placements[1].column = 21;
  assert.equal(publish(draft).grids[0].groups, undefined, 'a singleton published group is omitted');
});

test('custom default windows fit their ratio and thin Display windows can be captured without relaxing other modules', () => {
  for (const geometry of [{ columns: 24, rows: 24 }, { columns: 512, rows: 1 }, { columns: 1, rows: 512 }]) {
    const display = createNewDisplayPresentation(geometry);
    assert.equal(display.window.width / display.window.height, geometry.columns / geometry.rows);
    assert.ok(display.window.width <= 960 && display.window.height <= 720);
    const config = { version: 1, display, identity: { open: false, window: { left: 8, top: 8, width: 840 } } };
    assert.ok(isValidWorkbenchPresentation(config));
    assert.equal(isValidWorkbenchPresentation({ ...config, texts: [{ id: 'text:small', open: true, window: display.window }] }), geometry.columns === geometry.rows);
  }
});
