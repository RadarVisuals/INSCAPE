import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import {
  buildOwnerSystemWorkflowPublicationDocument,
  buildOwnerSystemWorkflowPreviewDocument,
} from './ownerSystemWorkflowPreviewDocument.js';
import { buildProfileDocumentV9Asset } from '../profileDocument/domain/profileDocumentV9Asset.js';
import { createCanonicalPublication } from '../profileDocument/domain/profileDocumentPublication.js';
import { canonicalSerializeProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Serialization.js';
import { imageDropGeometry } from '../imageModule/imageDropGeometry.js';
import {
  ownerSystemWorkflowAssetDimensions,
  ownerSystemWorkflowDecodedAsset,
} from './ownerSystemWorkflow/ownerSystemWorkflowAssetDimensions.js';

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

test('Preview rejects cross-profile draft authority', () => {
  const other = createEmptySystemWorkflowDraft('0x3333333333333333333333333333333333333333', { generateId: () => 'other' });
  assert.throws(() => buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: [], profile: {}, profileAddress: PROFILE, systemWorkflowDraft: other,
  }), /profile document authority/);

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

function imageRecord(asset, index = 0) {
  return { id: 'image:preview-' + index, name: asset.name, width: 300, height: 300, visibility: 'PUBLIC',
    artwork: { id: 'artwork:preview-' + index, asset: buildProfileDocumentV9Asset(asset, asset.id),
      crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } } };
}

test('decoded source dimensions drive drag geometry, placement, and published asset dimensions', () => {
  const source = 'https://assets.example/image.png';
  const decodedAsset = ownerSystemWorkflowDecodedAsset({
    ...asset(), imageUrl: source, imageWidth: 1920, imageHeight: 1080,
  }, { source, width: 1080, height: 1920 });
  const dimensions = ownerSystemWorkflowAssetDimensions(decodedAsset);
  assert.deepEqual(dimensions, { width: 1080, height: 1920 });
  const { destination } = imageDropGeometry(dimensions, { x: 320, y: 180 },
    { left: 0, top: 0, width: 640, height: 360 }, 1, { x: 0, y: 0 });
  assert.ok(destination.size.height > destination.size.width, 'Image placement uses the decoded portrait ratio');

  const systemWorkflowDraft = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' });
  systemWorkflowDraft.imageModules = [{ ...imageRecord(decodedAsset), ...destination.size }];

  const preview = buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: [decodedAsset], profile: { name: 'Resident' }, profileAddress: PROFILE, systemWorkflowDraft,
  });
  assert.deepEqual(preview.imageModules[0].artwork.asset.media, {
    url: source, width: 1080, height: 1920, type: 'image',
  });
});

test('missing dimensions remain unknown through owner and v9 projection', () => {
  const unknownAsset = { ...asset(), imageWidth: null, imageHeight: null };
  assert.equal(ownerSystemWorkflowAssetDimensions(unknownAsset), null);
  assert.deepEqual(buildProfileDocumentV9Asset(unknownAsset, ASSET).media, {
    url: unknownAsset.imageUrl, width: null, height: null, type: 'image',
  });
});

test('compact artwork references keep source dimensions and the public avatar retains its full source', () => {
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
  const compact = buildProfileDocumentV9Asset(onchainAsset, onchainAsset.id);
  assert.deepEqual(compact.media, {
    url: null, reference: onchainAsset.contentReference, width: 768, height: 768, type: 'image',
  });
  systemWorkflowDraft.identityPresentation.avatar = {
    mode: 'inscape', stableAssetId: onchainAsset.id, shape: 'square',
  };
  const avatarPreview = buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: [onchainAsset], profile: {}, profileAddress: PROFILE, systemWorkflowDraft,
  });
  assert.equal(avatarPreview.identityPresentation.avatar.asset.media.url, source,
    'the synchronous identity avatar retains its already-validated media source');
});
