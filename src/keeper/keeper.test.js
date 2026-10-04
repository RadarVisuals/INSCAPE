import test from 'node:test';
import assert from 'node:assert/strict';
import { addKeeperDock, saveKeeperDock } from './keeperSession.js';
import { validKeeperDocks, MAX_KEEPER_DOCKS, keeperSize, keeperMovement } from './keeper.js';
import { KEEPER_SWIM_DEFAULTS, keeperSwim } from './keeperSwim.js';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { validateSystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9, countProfileDocumentV9Assets } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { validateProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';
import { captureWorkbenchPresentation } from '../public/ownerSystemWorkflow/workbenchPresentationCapture.js';
import { loadWorkbenchLayout, saveWorkbenchLayout } from '../public/ownerSystemWorkflow/workbenchLayoutStorage.js';
import { createDisplayModuleSession } from '../systemWorkflow/displayModuleSession.js';
import { resolveLibraryImageAsset } from '../library/resolveLibraryImageAsset.js';
import { resolveImageLibrarySide } from '../imageModule/imageLibrarySide.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets } from '../public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
const profile = `0x${'1'.repeat(40)}`;
function fixture() {
  const entries = new Map(); let fail = false;
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('full'); entries.set(key, value); } };
  return { store: createSystemWorkflowDraftStore({ profileAddress: profile, storage }), storage, fail: value => { fail = value; } };
}
const build = draft => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft, assetRecords: assets });

test('Swim tuning is per Keeper, optional for old documents, undoable and retained through reload, publication and mode switches', () => {
  const { store, storage } = fixture(); addKeeperDock(store, profile); addKeeperDock(store, profile);
  assert.ok(saveKeeperDock(store, profile, store.getDraft().keeperDocks[0], { movement: 'swim', visibility: 'PUBLIC' }));
  const old = store.getDraft(), oldDocument = build(old);
  assert.ok(validateProfileDocumentV9(oldDocument).valid);
  assert.equal(Object.hasOwn(oldDocument.keeperDocks[0], 'swim'), false);
  assert.deepEqual(keeperSwim(reconcileSystemWorkflowDraftFromProfileDocumentV9(oldDocument).keeperDocks[0]), KEEPER_SWIM_DEFAULTS);
  const swim = { speed: 650, gatherSeconds: .2, spreadSeconds: .3, turnSeconds: .25, staggerSeconds: .1 };
  assert.ok(saveKeeperDock(store, profile, old.keeperDocks[0], { swim }));
  assert.deepEqual(keeperSwim(store.getDraft().keeperDocks[1]), KEEPER_SWIM_DEFAULTS);
  assert.equal(Object.hasOwn(store.getDraft().keeperDocks[1], 'swim'), false);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), old); assert.ok(store.redo());
  const reopened = createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft();
  assert.deepEqual(reopened.keeperDocks[0].swim, swim);
  const document = build(reopened); assert.ok(validateProfileDocumentV9(document).valid);
  assert.deepEqual(document.keeperDocks[0].swim, swim);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(document).keeperDocks[0].swim, swim);
  for (const invalid of [null, {}, [], { ...swim, speed: '650' }, { ...swim, speed: 901 }, { ...swim, speed: 79 },
    { ...swim, gatherSeconds: 0 }, { ...swim, spreadSeconds: Infinity }, { ...swim, turnSeconds: NaN },
    { ...swim, staggerSeconds: -.01 }, { ...swim, staggerSeconds: .21 }, { ...swim, unexpected: true }]) {
    assert.equal(saveKeeperDock(store, profile, store.getDraft().keeperDocks[0], { swim: invalid }), false);
    const malformed = structuredClone(document); malformed.keeperDocks[0].swim = invalid;
    assert.equal(validateProfileDocumentV9(malformed).valid, false);
  }
  assert.ok(saveKeeperDock(store, profile, store.getDraft().keeperDocks[0], { movement: 'flip' }));
  assert.deepEqual(store.getDraft().keeperDocks[0].swim, swim);
  assert.ok(saveKeeperDock(store, profile, store.getDraft().keeperDocks[0], { movement: 'swim', swim: { ...KEEPER_SWIM_DEFAULTS } }));
  assert.ok(store.undo()); assert.deepEqual(store.getDraft().keeperDocks[0].swim, swim);
});

test('Movement is per Keeper, preserves old flip records, and survives undo, reload and publication', () => {
  const { store, storage } = fixture(); addKeeperDock(store, profile); addKeeperDock(store, profile);
  const old = store.getDraft();
  assert.equal(keeperMovement(old.keeperDocks[0]), 'flip');
  assert.equal(Object.hasOwn(old.keeperDocks[0], 'movement'), false);
  assert.ok(saveKeeperDock(store, profile, old.keeperDocks[0], { movement: 'swim', visibility: 'PUBLIC' }));
  const swimming = store.getDraft();
  assert.equal(keeperMovement(swimming.keeperDocks[1]), 'flip');
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), old); assert.ok(store.redo());
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), swimming);
  const document = build(swimming); assert.ok(validateProfileDocumentV9(document).valid);
  assert.equal(document.keeperDocks[0].movement, 'swim');
  assert.equal(reconcileSystemWorkflowDraftFromProfileDocumentV9(document).keeperDocks[0].movement, 'swim');
  for (const movement of [null, '', 'rotate', {}, 1])
    assert.equal(saveKeeperDock(store, profile, store.getDraft().keeperDocks[0], { movement }), false);
  assert.ok(saveKeeperDock(store, profile, store.getDraft().keeperDocks[0], { movement: 'flip' }));
  assert.equal(keeperMovement(store.getDraft().keeperDocks[0]), 'flip');
});

test('Keeper size survives edit, undo, reload and publication; old records keep their original 128px size', () => {
  const { store, storage } = fixture(); addKeeperDock(store, profile);
  assert.equal(keeperSize(store.getDraft().keeperDocks[0]), 192);
  const legacy = store.getDraft(); delete legacy.keeperDocks[0].size; legacy.keeperDocks[0].visibility = 'PUBLIC';
  assert.ok(store.commitCompletedOperation(legacy, { expectedGeneration: store.getGeneration() }));
  assert.equal(keeperSize(store.getDraft().keeperDocks[0]), 128);
  const oldDocument = build(legacy); assert.ok(validateProfileDocumentV9(oldDocument).valid);
  assert.equal(Object.hasOwn(oldDocument.keeperDocks[0], 'size'), false);
  assert.equal(Object.hasOwn(reconcileSystemWorkflowDraftFromProfileDocumentV9(oldDocument).keeperDocks[0], 'size'), false);
  assert.ok(saveKeeperDock(store, profile, store.getDraft().keeperDocks[0], { size: 320 }));
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), legacy); assert.ok(store.redo());
  const reopened = createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft();
  assert.equal(keeperSize(reopened.keeperDocks[0]), 320);
  assert.equal(build(reopened).keeperDocks[0].size, 320);
  assert.equal(reconcileSystemWorkflowDraftFromProfileDocumentV9(build(reopened)).keeperDocks[0].size, 320);
  for (const size of [null, '192', 63, 385, 100.5, NaN])
    assert.equal(saveKeeperDock(store, profile, store.getDraft().keeperDocks[0], { size }), false);
});

test('Keeper creation, artwork replacement and removal are atomic, undoable and recover on reload', async () => {
  const { store, storage } = fixture(), old = store.getDraft();
  assert.ok(validateSystemWorkflowDraft(old).valid); assert.ok(validateProfileDocumentV9(build(old)).valid);
  const id = addKeeperDock(store, profile, { position: { left: 420, top: 80 } });
  assert.deepEqual(store.getDraft().workbench.keeperDocks, [{ id, position: { left: 420, top: 80 } }]);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), old); assert.ok(store.redo());
  const asset = await resolveLibraryImageAsset(assets[0]);
  assert.ok(saveKeeperDock(store, profile, store.getDraft().keeperDocks[0], { asset, faces: 'left' }));
  const before = store.getDraft();
  assert.ok(saveKeeperDock(store, profile, before.keeperDocks[0], { asset: await resolveLibraryImageAsset(assets[1]) }));
  assert.equal(store.getDraft().keeperDocks[0].asset.name, assets[1].name);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), before);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), before);
  assert.ok(removeWorkbenchModule(store, profile, 'keeper', before.keeperDocks[0]));
  assert.deepEqual(store.getDraft().keeperDocks, []); assert.deepEqual(store.getDraft().workbench.keeperDocks, []);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), before);
  createDisplayModuleSession(store, 'display:primary').createGrid();
  assert.deepEqual(store.getDraft().keeperDocks, before.keeperDocks);
});

test('Only public Keepers publish; legacy restoration retains local artwork and layout privately', async () => {
  const { store } = fixture(), oldDocument = build(store.getDraft());
  addKeeperDock(store, profile); addKeeperDock(store, profile);
  const asset = await resolveLibraryImageAsset(assets[0]);
  const beforeCount = countProfileDocumentV9Assets(build(store.getDraft()));
  assert.ok(saveKeeperDock(store, profile, store.getDraft().keeperDocks[0], { asset, visibility: 'PUBLIC' }));
  const draft = store.getDraft(), document = build(draft);
  assert.ok(validateProfileDocumentV9(document).valid); assert.ok(validKeeperDocks(document.keeperDocks, true));
  assert.equal(document.keeperDocks.length, 1); assert.equal(document.workbench.keeperDocks.length, 1);
  assert.equal(countProfileDocumentV9Assets(document), beforeCount + 1);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(document, draft).keeperDocks, draft.keeperDocks);
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(oldDocument, draft);
  assert.deepEqual(restored.keeperDocks, draft.keeperDocks.map(item => ({ ...item, visibility: 'PRIVATE' })));
  assert.deepEqual(restored.workbench.keeperDocks, draft.workbench.keeperDocks);
  const invalid = structuredClone(document); invalid.workbench.keeperDocks[0].id = 'keeper:missing';
  assert.equal(validateProfileDocumentV9(invalid).valid, false);
  const animated = structuredClone(draft); animated.keeperDocks[0].phase = 'free';
  assert.equal(validateSystemWorkflowDraft(animated).valid, false, 'temporary motion cannot enter saved schema');
  const malformed = structuredClone(document); malformed.keeperDocks[0].id = [malformed.keeperDocks[0].id];
  assert.equal(validateProfileDocumentV9(malformed).valid, false, 'module IDs must be strings, not coerced arrays');
});

test('Keeper refuses stale/profile/failed edits and bounds module count without overwriting work', () => {
  const f = fixture(); addKeeperDock(f.store, profile); const initial = f.store.getDraft(), expected = initial.keeperDocks[0];
  f.fail(true); assert.equal(saveKeeperDock(f.store, profile, expected, { name: 'Changed' }), false);
  assert.throws(() => addKeeperDock(f.store, profile)); assert.deepEqual(f.store.getDraft(), initial);
  f.fail(false); assert.equal(saveKeeperDock(f.store, `0x${'2'.repeat(40)}`, expected, { name: 'Changed' }), false);
  assert.ok(saveKeeperDock(f.store, profile, expected, { name: 'Changed' }));
  assert.equal(saveKeeperDock(f.store, profile, expected, { name: 'Obsolete' }), false);
  assert.equal(saveKeeperDock(f.store, profile, f.store.getDraft().keeperDocks[0], { faces: 'up' }), false);
  for (let i = 1; i < MAX_KEEPER_DOCKS; i++) addKeeperDock(f.store, profile);
  assert.throws(() => addKeeperDock(f.store, profile)); assert.equal(f.store.getDraft().keeperDocks.length, MAX_KEEPER_DOCKS);
});

test('Live dock positions cache separately; deleted membership cannot be resurrected by capture or reload', () => {
  const { store, storage } = fixture(); const id = addKeeperDock(store, profile), draft = store.getDraft();
  const live = { id, position: { left: 700, top: 300 } };
  const layout = captureWorkbenchPresentation({ layout: draft.workbench, keeperDocks: draft.keeperDocks, keeperPresentations: { [id]: live }, hasPrimaryDisplay: false, identityOpen: false }).value;
  assert.deepEqual(layout.keeperDocks, [live]); assert.ok(saveWorkbenchLayout(profile, draft, layout, {}, storage));
  assert.deepEqual(loadWorkbenchLayout(profile, draft, storage).layout.keeperDocks, [live]);
  assert.deepEqual(loadWorkbenchLayout(profile, { ...draft, keeperDocks: [] }, storage).layout.keeperDocks, []);
  assert.deepEqual(captureWorkbenchPresentation({ layout, keeperDocks: [], keeperPresentations: { [id]: live }, hasPrimaryDisplay: false, identityOpen: false }).value.keeperDocks, []);
});

test('Library resolver preserves selected attachment metadata for both Image and Keeper', async () => {
  const input = { ...assets[0], selectedMedia: { url: 'https://example.com/creature.svg', width: 600, height: 900 } };
  const asset = await resolveLibraryImageAsset(input), side = await resolveImageLibrarySide(input);
  assert.deepEqual(side.asset, asset); assert.equal(asset.media.url, input.selectedMedia.url);
  assert.equal(asset.media.width, 600); assert.equal(asset.media.height, 900);
  assert.equal(asset.stableAssetId, assets[0].id);
});
