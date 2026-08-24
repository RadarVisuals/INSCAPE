import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import {
  buildOwnerSystemWorkflowPublicationDocument,
  buildOwnerSystemWorkflowPreviewDocument,
  ownerSystemWorkflowPreviewEntryMediaUrls,
  preloadOwnerSystemWorkflowPreviewEntryMedia,
  profileDocumentV9EntryGrid,
} from './ownerSystemWorkflowPreviewDocument.js';
import { createCanonicalPublication } from '../profileDocument/domain/profileDocumentPublication.js';
import { canonicalSerializeProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Serialization.js';
import { adaptProfileDocumentV9Media } from '../profileDocument/components/profileDocumentV9Media.js';
import { createSystemWorkflowDropGeometry } from '../systemWorkflow/systemWorkflowPlacement.js';
import {
  ownerSystemWorkflowAssetDimensions,
  ownerSystemWorkflowDecodedAsset,
} from './ownerSystemWorkflow/ownerSystemWorkflowAssetDimensions.js';
import { createOwnerSystemWorkflowFocusViewModel } from './ownerSystemWorkflow/ownerSystemWorkflowFocusViewModel.js';

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

test('publication preparation freezes the exact canonical v9 bytes consumed by Preview and read-back', () => {
  const systemWorkflowDraft = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' });
  const prepared = buildOwnerSystemWorkflowPublicationDocument({
    assetRecords: [], exportedAt: 2, profile: { name: 'Resident' }, profileAddress: PROFILE,
    systemWorkflowDraft,
  });
  const artifact = createCanonicalPublication(prepared);
  assert.equal(artifact.document.version, 9);
  assert.equal(artifact.text, canonicalSerializeProfileDocumentV9(prepared));
  assert.deepEqual(artifact.bytes, new TextEncoder().encode(canonicalSerializeProfileDocumentV9(prepared)));

  const next = buildOwnerSystemWorkflowPublicationDocument({
    assetRecords: [], exportedAt: 3, previousDocument: prepared, profile: { name: 'Resident' },
    profileAddress: PROFILE, systemWorkflowDraft,
  });
  assert.equal(next.revision, 2);
  assert.equal(next.createdAt, prepared.createdAt);
  assert.equal(next.exportedAt, new Date(3).toISOString());
  assert.throws(() => buildOwnerSystemWorkflowPublicationDocument({
    assetRecords: [], exportedAt: 3, previousDocument: prepared, profile: {}, profileAddress: '0x3333333333333333333333333333333333333333',
    systemWorkflowDraft: createEmptySystemWorkflowDraft('0x3333333333333333333333333333333333333333', { generateId: () => 'other' }),
  }), /different profile/);
});

test('decoded source dimensions drive drag geometry, placement, owner metadata, and v9 Visitor media', () => {
  const source = 'https://assets.example/image.png';
  const decodedAsset = ownerSystemWorkflowDecodedAsset({
    ...asset(), imageUrl: source, imageWidth: 1920, imageHeight: 1080,
  }, { source, width: 1080, height: 1920 });
  const dimensions = ownerSystemWorkflowAssetDimensions(decodedAsset);
  assert.deepEqual(dimensions, { width: 1080, height: 1920 });
  const destination = createSystemWorkflowDropGeometry(dimensions.width, dimensions.height,
    { x: 320, y: 180 }, { left: 0, top: 0, width: 640, height: 360, cellSize: 20 });
  assert.ok(destination.rowSpan > destination.columnSpan, 'drag preview and placement use the decoded portrait ratio');

  const systemWorkflowDraft = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' });
  const placed = { ...placement('decoded-phone', 0), ...destination };
  systemWorkflowDraft.grids[0].placements = [placed];
  const ownerFocus = createOwnerSystemWorkflowFocusViewModel(placed, decodedAsset);
  assert.deepEqual(ownerFocus.focusDimensions, dimensions);
  assert.ok(ownerFocus.dossier.technical.some(({ label, value }) => label === 'SOURCE DIMENSIONS'
    && value === '1080 × 1920 PX'));

  const preview = buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: [decodedAsset], profile: { name: 'Resident' }, profileAddress: PROFILE, systemWorkflowDraft,
  });
  assert.deepEqual(preview.grids[0].placements[0].asset.media, {
    url: source, width: 1080, height: 1920, type: 'image',
  });
  assert.deepEqual(adaptProfileDocumentV9Media(preview.grids[0].placements[0].asset).dimensions, dimensions);
});

test('missing dimensions remain unknown through owner and v9 projection', () => {
  const unknownAsset = { ...asset(), imageWidth: null, imageHeight: null };
  assert.equal(ownerSystemWorkflowAssetDimensions(unknownAsset), null);
  const systemWorkflowDraft = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' });
  systemWorkflowDraft.grids[0].placements = [placement('unknown-media', 0)];
  const preview = buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: [unknownAsset], profile: {}, profileAddress: PROFILE, systemWorkflowDraft,
  });
  assert.deepEqual(preview.grids[0].placements[0].asset.media, {
    url: unknownAsset.imageUrl, width: null, height: null, type: 'image',
  });
  assert.equal(adaptProfileDocumentV9Media(preview.grids[0].placements[0].asset).dimensions, null);
});
