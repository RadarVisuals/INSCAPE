import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyWorkspace } from '../../library/domain/libraryWorkspace.js';
import { adaptLatticeProductionBrowserAsset, adaptLatticeProductionBrowserData } from './latticeProductionBrowserAdapter.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const OTHER_PROFILE = '0x2222222222222222222222222222222222222222';
const CONTRACT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ASSET_ID = `42:${CONTRACT}:contract`;

function asset(overrides = {}) {
  return {
    id: ASSET_ID,
    chainId: 42,
    ownerAddress: PROFILE,
    contractAddress: CONTRACT,
    tokenId: null,
    name: 'Real owned asset',
    collectionName: 'Real collection',
    thumbnailUrl: 'https://assets.example/thumbnail.webp',
    imageUrl: 'https://assets.example/image.webp',
    originalImageUrl: 'https://assets.example/original.webp',
    imageWidth: 1200,
    imageHeight: 800,
    ...overrides,
  };
}

test('real Browser adaptation validates owner scope, canonical identity, media, and immutable organization', () => {
  const workspace = {
    ...createEmptyWorkspace(PROFILE),
    favorites: [ASSET_ID],
    folders: [{ id: 'category-a', name: 'Category A', assetIds: [ASSET_ID], public: true,
      createdAt: 1, updatedAt: 2 }],
    categoryOrganization: { rootCategoryIds: [], sections: [
      { id: 'section-a', name: 'Section A', categoryIds: ['category-a'] },
    ] },
    canvas: { launchers: [], objects: [{ id: 'legacy-object' }] },
    tables: { placements: [{ id: 'legacy-placement' }] },
  };
  const before = structuredClone(workspace);
  const result = adaptLatticeProductionBrowserData({
    assets: [asset()], profileAddress: PROFILE, progress: { resolved: 1, total: 1 }, status: 'ready', workspace,
  });

  assert.equal(result.readOnly, false);
  assert.equal(result.assets.length, 1);
  assert.deepEqual(result.favorites, [ASSET_ID]);
  assert.deepEqual(result.categories, [{ id: 'category-a', name: 'Category A', assetIds: [ASSET_ID], public: true }]);
  assert.deepEqual(result.categoryOrganization, workspace.categoryOrganization);
  assert.equal(Object.isFrozen(result.categoryOrganization.sections[0].categoryIds), true);
  assert.equal(result.assets[0].stableAssetId, ASSET_ID);
  assert.equal(result.assets[0].placeable, true);
  assert.equal(result.assets[0].mediaType, 'image');
  assert.equal(result.assets[0].placementUnavailableReason, null);
  assert.equal(result.assets[0].src, 'https://assets.example/original.webp');
  assert.equal(result.assets[0].previewSrc, 'https://assets.example/thumbnail.webp');
  assert.deepEqual(result.assets[0].previewCandidates, [
    'https://assets.example/thumbnail.webp',
    'https://assets.example/image.webp',
    'https://assets.example/original.webp',
  ]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.categories[0].assetIds), true);
  assert.deepEqual(workspace, before);
});

test('placement eligibility allows bounded on-demand browser decoding when metadata dimensions are unresolved', () => {
  const workspace = createEmptyWorkspace(PROFILE);
  const missingDimensions = adaptLatticeProductionBrowserData({
    assets: [asset({ imageWidth: null })], profileAddress: PROFILE, workspace,
  }).assets[0];
  const missingMedia = adaptLatticeProductionBrowserData({
    assets: [asset({ thumbnailUrl: null, imageUrl: null, originalImageUrl: null })], profileAddress: PROFILE, workspace,
  }).assets[0];
  const unsupportedMedia = adaptLatticeProductionBrowserData({
    assets: [asset({ mediaType: 'video' })], profileAddress: PROFILE, workspace,
  }).assets[0];
  assert.equal(missingDimensions.placeable, true);
  assert.equal(missingDimensions.placementUnavailableReason, null);
  assert.equal(missingMedia.placeable, false);
  assert.equal(missingMedia.placementUnavailableReason, 'MEDIA UNAVAILABLE');
  assert.equal(unsupportedMedia.placeable, false);
  assert.equal(unsupportedMedia.placementUnavailableReason, 'MEDIA TYPE UNAVAILABLE');
});

test('preview candidates retain the original metadata URL as fallback after an indexer-derived source', () => {
  const adapted = adaptLatticeProductionBrowserAsset(asset({
    thumbnailUrl: 'https://indexer.example/image/stale',
    imageUrl: 'https://indexer.example/image/stale',
    originalImageUrl: 'https://indexer.example/image/stale',
    imageGroups: [{ variants: [
      { url: 'https://indexer.example/image/stale' },
      { url: 'https://gateway.example/ipfs/original' },
    ] }],
  }), PROFILE);
  assert.deepEqual(adapted.previewCandidates, [
    'https://indexer.example/image/stale',
    'https://gateway.example/ipfs/original',
  ]);
});

test('a collection token preview remains visible but cannot masquerade as placeable collection media', () => {
  const tokenId = `0x${'0'.repeat(63)}1`;
  const preview = adaptLatticeProductionBrowserAsset(asset({ isCollection: true, collectionPreviewTokenId: tokenId }), PROFILE);
  assert.equal(preview.previewSrc, 'https://assets.example/thumbnail.webp');
  assert.equal(preview.collectionPreviewTokenId, tokenId);
  assert.equal(preview.mediaType, 'image');
  assert.equal(preview.src, null);
  assert.equal(preview.placeable, false);
  assert.equal(preview.placementUnavailableReason, 'COLLECTION TOKEN PREVIEW ONLY');
});

test('missing, malformed, duplicate, and cross-profile records fail closed without changing memberships', () => {
  const workspace = {
    ...createEmptyWorkspace(PROFILE),
    favorites: [ASSET_ID, 'malformed'],
    folders: [{ id: 'category-a', name: 'Category A', assetIds: [ASSET_ID, 'unresolved'], public: false,
      createdAt: 1, updatedAt: 2 }],
  };
  const result = adaptLatticeProductionBrowserData({
    assets: [
      asset(),
      asset(),
      asset({ id: 'malformed' }),
      asset({ ownerAddress: OTHER_PROFILE }),
      asset({ chainId: 1 }),
    ],
    profileAddress: PROFILE,
    workspace,
  });
  assert.equal(result.assets.length, 1);
  assert.equal(result.rejectedAssetCount, 4);
  assert.deepEqual(result.favorites, workspace.favorites);
  assert.deepEqual(result.categories[0].assetIds, workspace.folders[0].assetIds);
});

test('wrong-profile workspace rejects its complete data boundary', () => {
  const result = adaptLatticeProductionBrowserData({
    assets: [asset()],
    profileAddress: PROFILE,
    workspace: createEmptyWorkspace(OTHER_PROFILE),
  });
  assert.deepEqual(result.assets, []);
  assert.deepEqual(result.categories, []);
  assert.deepEqual(result.favorites, []);
});

test('created-only acceptance is explicit and requires strong profile-address provenance', () => {
  const created = asset({ ownerAddress: null, viewedProfileIsCreator: true, creatorAttributionLevel: 'contract',
    creators: [{ address: PROFILE }], ownershipKnown: true, isOwnedByViewedProfile: false });
  assert.equal(adaptLatticeProductionBrowserAsset(created, PROFILE), null);
  assert.equal(adaptLatticeProductionBrowserAsset(created, PROFILE, true).stableAssetId, ASSET_ID);
  assert.equal(adaptLatticeProductionBrowserAsset({ ...created, creatorAttributionLevel: 'authored' }, PROFILE, true), null);
  assert.equal(adaptLatticeProductionBrowserAsset({ ...created, creators: [{ address: OTHER_PROFILE }] }, PROFILE, true), null);
});

test('collection-derived acceptance requires explicit parent creator provenance', () => {
  const collectionChild = asset({
    ownerAddress: null, viewedProfileIsCreator: false, creatorAttributionLevel: null,
    creators: [{ address: OTHER_PROFILE }], viewedProfileIsCollectionCreator: true,
    collectionCreatorAttributionLevel: 'contract', collectionCreators: [{ address: PROFILE }],
  });
  assert.equal(adaptLatticeProductionBrowserAsset(collectionChild, PROFILE), null);
  assert.equal(adaptLatticeProductionBrowserAsset(collectionChild, PROFILE, true).stableAssetId, ASSET_ID);
  assert.equal(adaptLatticeProductionBrowserAsset({ ...collectionChild,
    collectionCreators: [{ address: OTHER_PROFILE }] }, PROFILE, true), null);
});
