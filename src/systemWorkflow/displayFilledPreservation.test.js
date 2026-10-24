import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from './systemWorkflowDraftStore.js';
import { createDisplayModuleSession } from './displayModuleSession.js';
import { createSystemWorkflowGroupMovementRequest } from './systemWorkflowMovement.js';
import { systemWorkflowGridFingerprint } from './domain/systemWorkflowGrid.js';
import { createFilledDisplayDraft, filledAssets, filledProfile, filledDisplayId, filledSvgMetadata } from './fixtures/displayFilledFixture.js';
import { metadataImages } from '../library/data/metadataImages.js';
import { selectImageGroups } from '../library/data/resolveContentUrl.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { createProfileDocumentV9AssetResolver } from '../profileDocument/domain/profileDocumentV9Asset.js';

function setup() {
  const initial = createFilledDisplayDraft(), key = systemWorkflowDraftKey(filledProfile);
  const values = new Map([[key, JSON.stringify(initial)]]);
  let failed = false, writes = 0;
  const storage = { getItem: name => values.get(name) ?? null, setItem: (name, raw) => {
    if (failed) throw new Error('storage full');
    writes++; values.set(name, raw);
  } };
  const store = createSystemWorkflowDraftStore({ profileAddress: filledProfile, storage });
  return { initial, key, values, storage, store, writes: () => writes, fail: value => { failed = value; } };
}
const count = draft => draft.grids.concat(...(draft.displays || []).map(display => display.grids))
  .reduce((total, grid) => total + grid.placements.length, 0);

test('XML-labelled SVG selection retains source identity, metadata and authored values through persistence and public restore', () => {
  const f = setup(), sourceMetadata = structuredClone(filledSvgMetadata);
  const [choice] = selectImageGroups(metadataImages(sourceMetadata));
  assert.equal(choice.fileType, 'application/xml');
  const original = f.initial.grids[0].placements[0];
  assert.equal(original.selectedMedia.url, choice.imageUrl);
  assert.match(choice.imageUrl, /\.svg\?version=2$/);
  const session = createDisplayModuleSession(f.store, 'display:primary');
  assert.equal(session.renameGrid({ gridId: f.initial.grids[0].id,
    expectedGridFingerprint: systemWorkflowGridFingerprint(f.initial.grids[0]), name: 'SVG preserved' }), true);
  const reloaded = createSystemWorkflowDraftStore({ profileAddress: filledProfile, storage: f.storage }).getDraft();
  assert.deepEqual(reloaded.grids[0].placements[0], original);
  const document = buildProfileDocumentV9({ profileAddress: filledProfile, systemWorkflowDraft: reloaded, assetRecords: filledAssets });
  const published = document.grids[0].placements.find(item => item.id === original.id);
  assert.deepEqual(published.asset.media, { url: choice.imageUrl, width: 1400, height: 1100, type: 'image' });
  assert.equal(published.asset.stableAssetId, original.stableAssetId);
  assert.deepEqual(published.asset.attributes, filledAssets[0].attributes);
  assert.equal(published.asset.name, filledAssets[0].name);
  assert.deepEqual(published.crop, original.crop);
  assert.deepEqual(published.transform, original.transform);
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(document, reloaded);
  assert.deepEqual(restored.grids[0].placements.find(item => item.id === original.id), original);
  assert.deepEqual(buildProfileDocumentV9({ profileAddress: filledProfile, systemWorkflowDraft: restored, assetRecords: filledAssets }), document);
  assert.deepEqual(sourceMetadata, filledSvgMetadata, 'declared XML source metadata is not rewritten');
});

test('96-artwork multi-Display drafts reload exactly and grouped edits stay atomic through undo and failed saves', () => {
  const f = setup();
  assert.equal(count(f.initial), 96);
  assert.deepEqual(f.store.getDraft(), f.initial);
  assert.equal(f.writes(), 0, 'reading representative saved data does not rewrite it');
  const session = createDisplayModuleSession(f.store, 'display:primary');
  const grid = f.initial.grids[0], members = grid.groups[0].placementIds.map(id => grid.placements.find(p => p.id === id));
  const request = createSystemWorkflowGroupMovementRequest(members, { column: 1, row: 1 }, grid.id);
  f.fail(true);
  assert.throws(() => session.movePlacements(request), /could not be saved/);
  assert.deepEqual(f.store.getDraft(), f.initial);
  assert.deepEqual(f.store.getHistory(), { undo: null, redo: null });
  assert.equal(f.values.get(f.key), JSON.stringify(f.initial));
  f.fail(false);
  assert.equal(session.movePlacements(request), true);
  const moved = f.store.getDraft();
  assert.equal(f.writes(), 1);
  assert.deepEqual(moved.displays, f.initial.displays);
  assert.deepEqual(moved.grids.slice(1), f.initial.grids.slice(1));
  for (const placement of moved.grids[0].placements) {
    const original = grid.placements.find(p => p.id === placement.id);
    assert.deepEqual(placement, grid.groups[0].placementIds.includes(placement.id)
      ? { ...original, column: original.column + 1, row: original.row + 1 } : original);
  }
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: filledProfile, storage: f.storage }).getDraft(), moved);
  f.fail(true);
  assert.equal(f.store.undo(), false);
  assert.deepEqual(f.store.getDraft(), moved);
  f.fail(false);
  assert.equal(f.store.undo(), true); assert.deepEqual(f.store.getDraft(), f.initial);
  assert.equal(f.store.redo(), true); assert.deepEqual(f.store.getDraft(), moved);
  assert.throws(() => session.movePlacements(request), /changed before movement/);
  assert.deepEqual(f.store.getDraft(), moved);
});

test('duplicating a filled secondary Grid preserves media, transforms, groups and primary content', () => {
  const f = setup(), session = createDisplayModuleSession(f.store, filledDisplayId);
  const source = f.initial.displays[0].grids[0];
  assert.equal(session.duplicateGrid({ gridId: source.id, expectedGridFingerprint: systemWorkflowGridFingerprint(source), generateId: () => 'filled-copy' }), true);
  const saved = f.store.getDraft(), copy = saved.displays[0].grids.find(grid => grid.id === 'grid:filled-copy');
  assert.equal(copy.placements.length, 32); assert.equal(copy.visibility, 'PRIVATE');
  assert.deepEqual(saved.grids, f.initial.grids);
  for (let index = 0; index < 32; index++) {
    const { id: beforeId, ...before } = source.placements[index], { id: afterId, ...after } = copy.placements[index];
    assert.notEqual(afterId, beforeId); assert.deepEqual(after, before);
  }
  assert.deepEqual(copy.groups.map(group => group.placementIds.map(id => copy.placements.findIndex(p => p.id === id))),
    source.groups.map(group => group.placementIds.map(id => source.placements.findIndex(p => p.id === id))));
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: filledProfile, storage: f.storage }).getDraft(), saved);
  assert.equal(f.store.undo(), true); assert.deepEqual(f.store.getDraft(), f.initial);
  assert.equal(f.store.redo(), true); assert.deepEqual(f.store.getDraft(), saved);
});

test('interleaved filled Display saves preserve their neighbors and reject externally changed storage', () => {
  const f = setup(), primary = createDisplayModuleSession(f.store, 'display:primary');
  const secondary = createDisplayModuleSession(f.store, filledDisplayId);
  primary.selectGrid('grid:filled-private'); primary.selectGrid('grid:filled-main');
  assert.equal(f.writes(), 0, 'scene navigation is temporary and does not save');
  const rename = (session, name) => {
    const state = session.getState(), grid = state.draft.grids.find(g => g.id === state.selectedGridId);
    return session.renameGrid({ gridId: grid.id, expectedGridFingerprint: systemWorkflowGridFingerprint(grid), name });
  };
  assert.equal(rename(primary, 'First composition'), true);
  const afterPrimary = f.store.getDraft();
  assert.equal(rename(secondary, 'Second composition'), true);
  const afterBoth = f.store.getDraft();
  assert.deepEqual(afterBoth.grids, afterPrimary.grids);
  assert.deepEqual(afterBoth.displays[0].grids[0].placements, f.initial.displays[0].grids[0].placements);
  assert.equal(f.store.undo(), true); assert.deepEqual(f.store.getDraft(), afterPrimary);
  assert.equal(f.store.undo(), true); assert.deepEqual(f.store.getDraft(), f.initial);
  assert.equal(f.store.redo(), true); assert.equal(f.store.redo(), true);
  assert.deepEqual(f.store.getDraft(), afterBoth);
  const external = createSystemWorkflowDraftStore({ profileAddress: filledProfile, storage: f.storage });
  const externalSession = createDisplayModuleSession(external, filledDisplayId);
  assert.equal(rename(externalSession, 'Externally saved composition'), true);
  const externalRaw = f.values.get(f.key), localHistory = f.store.getHistory();
  assert.throws(() => rename(primary, 'Obsolete save'), /could not be saved/);
  assert.deepEqual(f.store.getDraft(), afterBoth);
  assert.deepEqual(f.store.getHistory(), localHistory);
  assert.equal(f.values.get(f.key), externalRaw);
  f.store.reload();
  assert.deepEqual(f.store.getDraft(), external.getDraft());
  assert.equal(count(f.store.getDraft()), 96);
});

test('pure public projection and restore preserve filled scene source identity and supported authored values', () => {
  const f = setup(), before = structuredClone(f.initial);
  const document = buildProfileDocumentV9({ profileAddress: filledProfile, systemWorkflowDraft: f.initial, assetRecords: filledAssets });
  assert.deepEqual(f.initial, before, 'projection cannot mutate the authored draft');
  assert.equal(f.writes(), 0, 'pure projection performs no save/upload');
  assert.equal(document.grids.length, 1);
  assert.equal(document.displays.length, 1);
  const resolveAsset = createProfileDocumentV9AssetResolver(filledAssets);
  for (const [source, published] of [[before.grids[0], document.grids[0]], [before.displays[0].grids[0], document.displays[0].grids[0]]]) {
    assert.equal(published.placements.length, 30, 'private and fully outside layers are omitted');
    assert.equal(published.groups.at(-1).placementIds.length, 2, 'remaining visible members retain the group');
    for (const placement of published.placements) {
      const original = source.placements.find(p => p.id === placement.id);
      const { stableAssetId, selectedMedia, locked, ...authored } = original;
      assert.deepEqual(placement, { ...authored, asset: resolveAsset(stableAssetId, selectedMedia) });
    }
  }
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(document, before);
  assert.deepEqual(restored.grids.find(grid => grid.id === 'grid:filled-private'), before.grids[1]);
  assert.deepEqual(restored.workbench, before.workbench);
  for (const [published, grid] of [[document.grids[0], restored.grids[0]], [document.displays[0].grids[0], restored.displays[0].grids[0]]]) {
    assert.deepEqual(grid.groups, published.groups);
    for (const placement of grid.placements) {
      const { asset, ...authored } = published.placements.find(p => p.id === placement.id);
      assert.deepEqual(placement, { ...authored, stableAssetId: asset.stableAssetId,
        selectedMedia: { url: asset.media.url, width: asset.media.width, height: asset.media.height }, locked: false });
    }
  }
  assert.deepEqual(buildProfileDocumentV9({ profileAddress: filledProfile, systemWorkflowDraft: restored, assetRecords: filledAssets }), document,
    'restoring and projecting the public snapshot is content-stable');
});
