import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft, assertValidSystemWorkflowDraft } from './systemWorkflowDraft.js';
import { createSystemWorkflowPlacementCandidate } from '../systemWorkflowPlacement.js';
import { buildProfileDocumentV9 } from '../../profileDocument/domain/profileDocumentV9Builder.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { assetForPlacement } from './placementMedia.js';
import { createOwnerSystemWorkflowFocusViewModel } from '../../public/ownerSystemWorkflow/ownerSystemWorkflowFocusViewModel.js';

const profile = '0x1111111111111111111111111111111111111111';
const contractAddress = '0x2222222222222222222222222222222222222222';
const asset = { id: `42:${contractAddress}:0x01`, chainId: 42, contractAddress, tokenId: '0x01', standard: 'LSP8',
  name: 'Character', imageUrl: 'https://art.test/portrait.png', imageWidth: 1200, imageHeight: 1200 };
const selectedMedia = { url: 'https://art.test/transparent.png', width: 400, height: 900 };

test('two placements of one token retain independent images through save, publication, restore and focus', () => {
  let draft = createEmptySystemWorkflowDraft(profile, { generateId: () => 'home' });
  for (const [index, media] of [undefined, selectedMedia].entries()) draft = createSystemWorkflowPlacementCandidate(draft, {
    stableAssetId: asset.id, selectedMedia: media, gridId: draft.grids[0].id,
    nativeWidth: media?.width || 1200, nativeHeight: media?.height || 1200, generatePlacementId: () => `placement-${index}`,
  });
  const reopened = assertValidSystemWorkflowDraft(JSON.parse(JSON.stringify(draft)));
  assert.equal(assetForPlacement(asset, reopened.grids[0].placements[0]).imageUrl, asset.imageUrl);
  assert.equal(assetForPlacement(asset, reopened.grids[0].placements[1]).imageUrl, selectedMedia.url);
  const document = buildProfileDocumentV9({ assetRecords: [asset], profileAddress: profile, systemWorkflowDraft: reopened });
  assert.deepEqual(document.grids[0].placements.map(({ asset: item }) => item.media.url), [asset.imageUrl, selectedMedia.url]);
  assert.ok(document.grids[0].placements.every(({ asset: item }) => item.stableAssetId === asset.id));
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(document);
  const second = restored.grids[0].placements[1];
  assert.deepEqual(second.selectedMedia, selectedMedia);
  const focus = createOwnerSystemWorkflowFocusViewModel(second, asset);
  assert.equal(focus.media.src, selectedMedia.url);
  assert.deepEqual(focus.focusDimensions, { width: 400, height: 900 });
  assert.deepEqual(buildProfileDocumentV9({ assetRecords: [asset], profileAddress: profile, systemWorkflowDraft: restored }).grids, document.grids);
});

test('selected image validates URLs, dimensions, and exact structure at the draft boundary', () => {
  for (const media of [
    { ...selectedMedia, url: 'javascript:alert(1)' }, { ...selectedMedia, width: -1 },
    { ...selectedMedia, extra: true }, { url: selectedMedia.url },
  ]) {
    const draft = createEmptySystemWorkflowDraft(profile, { generateId: () => 'home' });
    assert.throws(() => createSystemWorkflowPlacementCandidate(draft, { stableAssetId: asset.id,
      selectedMedia: media, gridId: draft.grids[0].id, nativeWidth: 400, nativeHeight: 900, generatePlacementId: () => 'placement-one' }));
  }
});
