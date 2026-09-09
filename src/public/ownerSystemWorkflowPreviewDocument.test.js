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

test('compact verified on-chain media keeps its ratio and many Burnt Pix placements inside v9', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1025 1025"><desc>${'x'.repeat(192_000)}</desc><rect width="1025" height="1025"/></svg>`;
  const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  assert.ok(source.length > 256_000, 'the fixture stays representative of the real Burnt Pix payload scale');
  const onchainAsset = {
    ...asset(), imageUrl: source, originalImageUrl: source, imageWidth: 768, imageHeight: 768,
    contractAddress: '0x3983151e0442906000dab83c8b1cf3f2d2535f82',
    tokenId: '0x00000000000000000000000085bc3f6772107468dd9edf194f114b0c8c66eb71',
    contentReference: {
      protocol: 'erc725y', scope: 'tokenId',
      dataKey: '0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e',
      verification: { method: 'keccak256(utf8)', data: `0x${'11'.repeat(32)}` },
    },
  };
  onchainAsset.id = `42:${onchainAsset.contractAddress}:${onchainAsset.tokenId}`;
  const systemWorkflowDraft = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' });
  systemWorkflowDraft.grids[0].placements = [{
    ...placement('burnt-pix', 0), stableAssetId: onchainAsset.id, columnSpan: 6, rowSpan: 6,
  }];
  const preview = buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: [onchainAsset], profile: {}, profileAddress: PROFILE, systemWorkflowDraft,
  });
  assert.deepEqual(ownerSystemWorkflowPreviewEntryMediaUrls(preview), []);
  assert.deepEqual(preview.grids[0].placements[0].asset.media, {
    url: null, reference: onchainAsset.contentReference, width: 768, height: 768, type: 'image',
  });
  assert.deepEqual(adaptProfileDocumentV9Media(preview.grids[0].placements[0].asset, {
    resolvedUrl: source, resolutionComplete: true,
  }), {
    status: 'ready', dimensions: { width: 768, height: 768 }, label: 'Preview artwork',
    src: source, stableAssetId: onchainAsset.id,
  });
  assert.deepEqual(adaptProfileDocumentV9Media(preview.grids[0].placements[0].asset, {
    decodedDimensions: { width: 150, height: 150 }, resolvedUrl: source, resolutionComplete: true,
  }).dimensions, { width: 150, height: 150 });
  assert.equal(canonicalSerializeProfileDocumentV9(preview).includes(source), false);
  assert.ok(new TextEncoder().encode(canonicalSerializeProfileDocumentV9(preview)).byteLength < 512 * 1024);

  systemWorkflowDraft.identityPresentation.avatar = {
    mode: 'inscape', stableAssetId: onchainAsset.id, shape: 'square',
  };
  const avatarPreview = buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: [onchainAsset], profile: {}, profileAddress: PROFILE, systemWorkflowDraft,
  });
  assert.equal(avatarPreview.identityPresentation.avatar.asset.media.url, source,
    'the synchronous identity avatar retains its already-validated media source');
  systemWorkflowDraft.identityPresentation.avatar = { mode: 'official', stableAssetId: null, shape: 'square' };

  systemWorkflowDraft.grids[0].placements = Array.from({ length: 15 }, (_entry, index) => ({
    ...placement(`burnt-pix-repeat-${index}`, index), stableAssetId: onchainAsset.id,
  }));
  const repeatedPreview = buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: [onchainAsset], profile: {}, profileAddress: PROFILE, systemWorkflowDraft,
  });
  assert.equal(repeatedPreview.grids[0].placements.length, 15);
  assert.ok(new TextEncoder().encode(canonicalSerializeProfileDocumentV9(repeatedPreview)).byteLength < 512 * 1024);

  const distinctAssets = Array.from({ length: 15 }, (_entry, index) => {
    const tokenId = `0x${(index + 1).toString(16).padStart(64, '0')}`;
    return { ...onchainAsset, id: `42:${onchainAsset.contractAddress}:${tokenId}`, tokenId,
      contentReference: { ...onchainAsset.contentReference,
        verification: { method: 'keccak256(utf8)', data: `0x${(index + 1).toString(16).padStart(64, '0')}` } } };
  });
  systemWorkflowDraft.grids[0].placements = distinctAssets.map((entry, index) => ({
    ...placement(`burnt-pix-distinct-${index}`, index), stableAssetId: entry.id,
  }));
  const distinctPreview = buildOwnerSystemWorkflowPublicationDocument({
    assetRecords: distinctAssets, exportedAt: 2, profile: {}, profileAddress: PROFILE, systemWorkflowDraft,
  });
  assert.equal(distinctPreview.grids[0].placements.length, 15);
  assert.ok(new TextEncoder().encode(canonicalSerializeProfileDocumentV9(distinctPreview)).byteLength < 512 * 1024);
});
