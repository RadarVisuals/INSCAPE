import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import {
  buildOwnerSystemWorkflowPreviewDocument,
  ownerSystemWorkflowPreviewEntryMediaUrls,
  preloadOwnerSystemWorkflowPreviewEntryMedia,
  profileDocumentV9EntryGrid,
} from './ownerSystemWorkflowPreviewDocument.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CONTRACT = '0x2222222222222222222222222222222222222222';
const ASSET = `42:${CONTRACT}:0x01`;
const asset = () => ({
  id: ASSET, chainId: 42, contractAddress: CONTRACT, tokenId: '0x01', standard: 'LSP8',
  name: 'Preview artwork', description: '', imageUrl: 'https://assets.example/image.png',
  imageWidth: 1600, imageHeight: 900, creators: [], attributes: [],
});
const placement = (id, order) => ({
  id, stableAssetId: ASSET, column: order, row: 0, columnSpan: 1, rowSpan: 1,
  layer: order, navigationOrder: order, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
});

test('Preview uses the v9 builder and the first Grid remaining after public filtering', async () => {
  const draft = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'private-first' });
  draft.grids[0].visibility = 'PRIVATE';
  draft.grids.push({
    ...structuredClone(draft.grids[0]), id: 'grid:visitor-entry', title: 'VISITOR ENTRY', visibility: 'PUBLIC',
    placements: [placement('one', 0), placement('two', 1)],
  });
  draft.grids.push({
    ...structuredClone(draft.grids[1]), id: 'grid:later', title: 'LATER', placements: [placement('later', 0)],
  });
  const preview = buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: [asset()], profile: { name: 'Resident' }, profileAddress: PROFILE, systemWorkflowDraft: draft,
  });
  assert.equal(preview.version, 9);
  assert.equal(profileDocumentV9EntryGrid(preview).id, 'grid:visitor-entry');
  assert.deepEqual(ownerSystemWorkflowPreviewEntryMediaUrls(preview), ['https://assets.example/image.png']);

  const decoded = [];
  class FakeImage {
    set src(value) { this.source = value; }
    decode() { decoded.push(this.source); return Promise.resolve(); }
  }
  await preloadOwnerSystemWorkflowPreviewEntryMedia(preview, { ImageConstructor: FakeImage });
  assert.deepEqual(decoded, ['https://assets.example/image.png']);
});

test('Preview rejects cross-profile draft authority and a draft without public Grids', () => {
  const other = createEmptySystemWorkflowDraft('0x3333333333333333333333333333333333333333', { generateId: () => 'other' });
  assert.throws(() => buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: [], profile: {}, profileAddress: PROFILE, systemWorkflowDraft: other,
  }), /profile document authority/);
  const privateOnly = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'private' });
  privateOnly.grids[0].visibility = 'PRIVATE';
  assert.throws(() => buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: [], profile: {}, profileAddress: PROFILE, systemWorkflowDraft: privateOnly,
  }), { code: 'INSCAPE_PROFILE_PUBLIC_GRID_REQUIRED' });
});

test('Preview v9 retains every public placement presentation field and removes private content', () => {
  const draft = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' });
  const publicPlacement = {
    ...placement('public-artwork', 7), column: 8, row: 5, columnSpan: 6, rowSpan: 4, layer: 3,
    crop: { x: 0.42, y: 0.57, zoom: 1.8 }, frameId: 'DOSSIER', transparencyMode: 'OPAQUE',
    mat: { enabled: true, color: '#102030', inset: { top: 0.1, right: 0.2, bottom: 0.1, left: 0.2 } },
    backing: { enabled: true, color: '#d0c0b0' },
    transform: { quarterTurns: 3, mirrorX: true, mirrorY: true },
  };
  draft.grids[0].placements = [publicPlacement, { ...placement('private-artwork', 1), visibility: 'PRIVATE' }];
  const preview = buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: [asset()], profile: { name: 'Resident' }, profileAddress: PROFILE, systemWorkflowDraft: draft,
  });
  assert.equal(preview.grids[0].placements.length, 1);
  const { asset: resolvedAsset, visibility, ...projected } = preview.grids[0].placements[0];
  const { locked: _locked, stableAssetId: _stableAssetId, visibility: _sourceVisibility, ...expected } = publicPlacement;
  assert.deepEqual(projected, expected);
  assert.equal(visibility, 'PUBLIC');
  assert.equal(resolvedAsset.stableAssetId, ASSET);
  assert.equal(JSON.stringify(preview).includes('private-artwork'), false);
});
