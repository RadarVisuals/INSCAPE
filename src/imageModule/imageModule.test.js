import test from 'node:test';
import assert from 'node:assert/strict';
import { validImageModules, createImagePresentation, imageFocusEntry, nextImageSide } from './imageModule.js';
import { addImageModule, saveImageModule } from './imageModuleSession.js';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { assertValidSystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9, countProfileDocumentV9Assets } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { assertValidProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { createProfileDocumentV9AssetResolver } from '../profileDocument/domain/profileDocumentV9Asset.js';
import { createDefaultWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';
import { createDisplayModuleSession, addDisplayModule } from '../systemWorkflow/displayModuleSession.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets } from '../public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { projectLatticeProductionFocusMediaMotion } from '../lattice/rendering/latticeProductionFocusArtworkMotion.js';
const profile = `0x${'1'.repeat(40)}`;
const asset = createProfileDocumentV9AssetResolver(assets, { compactContentReference: false })(assets[0].id);
const side = id => ({ id: `side:${id}`, asset: structuredClone(asset), crop: { x: .4, y: .5, zoom: 2 }, transform: { quarterTurns: 1, mirrorX: true, mirrorY: false } });
function fixture() {
  const entries = new Map(); let failed = false;
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => { if (failed) throw Error('full'); entries.set(key, value); } };
  return { store: createSystemWorkflowDraftStore({ profileAddress: profile, storage }), storage, entries, fail: value => { failed = value; } };
}
const documentFor = draft => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft, assetRecords: [] });
test('Image uses existing draft storage, rejects stale/profile/failed edits, and undo restores authored size and sides', () => {
  const f = fixture(), before = f.store.getDraft();
  assert.deepEqual(assertValidSystemWorkflowDraft(before), before);
  assert.equal('imageModules' in documentFor(before), false);
  addImageModule(f.store, profile); const record = f.store.getDraft().imageModules[0];
  assert.equal(record.visibility, 'PRIVATE');
  const next = { ...record, width: 640, height: 64, sides: [side('one'), side('two')] };
  assert.ok(saveImageModule(f.store, profile, record, next));
  assert.equal(saveImageModule(f.store, profile, record, next), false);
  assert.equal(saveImageModule(f.store, `0x${'2'.repeat(40)}`, next, record), false);
  f.fail(true); assert.equal(saveImageModule(f.store, profile, next, record), false);
  assert.deepEqual(f.store.getDraft().imageModules[0], next);
  f.fail(false); assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft().imageModules[0], record);
  assert.ok(f.store.redo()); assert.deepEqual(f.store.getDraft().imageModules[0], next);
  assert.ok(f.entries.has(systemWorkflowDraftKey(profile)));
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage }).getDraft(), f.store.getDraft());
});
test('public Image preserves crop, transforms and provenance; older publication restore retains local modules as private', () => {
  const f = fixture(); const old = documentFor(f.store.getDraft());
  addImageModule(f.store, profile); addImageModule(f.store, profile);
  const draft = f.store.getDraft(); draft.imageModules[0] = { ...draft.imageModules[0], width: 64, height: 600, sides: [side('a'), side('b')], visibility: 'PUBLIC' };
  draft.imageModules[1].sides = [side('private')];
  draft.workbench = { ...createDefaultWorkbenchPresentation(), imageModules: draft.imageModules.map((item, index) => createImagePresentation(item.id, index)) };
  const doc = documentFor(draft);
  assert.equal(doc.imageModules.length, 1); assert.equal(doc.workbench.imageModules.length, 1);
  assert.equal(countProfileDocumentV9Assets(doc), 2);
  assert.deepEqual(doc.imageModules[0].sides, draft.imageModules[0].sides);
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, draft);
  assert.deepEqual(restored.imageModules, draft.imageModules);
  const previous = reconcileSystemWorkflowDraftFromProfileDocumentV9(old, draft);
  assert.ok(previous.imageModules.every(item => item.visibility === 'PRIVATE'));
  assert.deepEqual(previous.workbench.imageModules, draft.workbench.imageModules);
  const broken = structuredClone(doc); broken.workbench.imageModules[0].id = 'image:missing';
  assert.throws(() => assertValidProfileDocumentV9(broken));
});
test('Image survives Display edits and module deletion is atomic with its saved layout', () => {
  const { store } = fixture(); addImageModule(store, profile); const id = addDisplayModule(store);
  const image = store.getDraft().imageModules[0];
  createDisplayModuleSession(store, id).createGrid();
  assert.deepEqual(store.getDraft().imageModules[0], image);
  const draft = store.getDraft(); draft.workbench = { ...createDefaultWorkbenchPresentation(), imageModules: [createImagePresentation(image.id)] };
  assert.ok(store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() }));
  assert.ok(removeWorkbenchModule(store, profile, 'image', image));
  assert.deepEqual(store.getDraft().imageModules, []); assert.deepEqual(store.getDraft().workbench.imageModules, []);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft().imageModules[0], image);
});
test('bounds reject malformed content and side flips wrap without changing authored data', () => {
  const { store } = fixture(); addImageModule(store, profile); const record = { ...store.getDraft().imageModules[0], sides: [side('a')] };
  assert.ok(validImageModules([record]));
  for (const bad of [null, {}, { ...record, width: 0 }, { ...record, height: 4097 }, { ...record, sides: [null] }, { ...record, sides: [side('a'), side('a')] }, { ...record, sides: [{ ...side('x'), asset: null }] }]) assert.equal(validImageModules([bad]), false);
  assert.deepEqual([nextImageSide(0, 3), nextImageSide(1, 3), nextImageSide(2, 3), nextImageSide(0, 1)], [1, 2, 0, 0]);
  const entry = imageFocusEntry(record.sides[0]); const source = { left: 0, top: 0, width: 600, height: 64 };
  const ipfsSide = side('ipfs'); ipfsSide.asset.media.url = 'ipfs://QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw/art.png';
  assert.match(imageFocusEntry(ipfsSide).media.src, /^https:\/\//u);
  assert.match(imageFocusEntry(ipfsSide).media.src, /art\.png$/u);
  assert.equal(Object.hasOwn(entry.placement, 'mat'), false);
  for (const progress of [0, .5, 1]) {
    const result = projectLatticeProductionFocusMediaMotion(entry.placement, entry.focusDimensions, { sourceRectangle: source, focusedRectangle: { ...source, width: 600, height: 600 }, currentRectangle: source, progress });
    assert.ok(Object.values(result.rectangle).every(Number.isFinite));
  }
});
