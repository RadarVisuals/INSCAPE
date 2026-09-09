import assert from 'node:assert/strict';
import test from 'node:test';
import { projectLibraryAssetUnion } from './libraryAssetUnion.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CONTRACT_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const CONTRACT_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const id = (contract) => `42:${contract}:contract`;
const tokenId = (contract, token = '0x01') => `42:${contract}:${token}`;
const media = { imageUrl: 'https://example.com/image.png', thumbnailUrl: 'https://example.com/thumb.png',
  originalImageUrl: 'https://example.com/original.png', imageWidth: 1200, imageHeight: 800 };
const owned = (contract = CONTRACT_A, overrides = {}) => ({ id: id(contract), chainId: 42, ownerAddress: PROFILE,
  contractAddress: contract, tokenId: null, standard: 'LSP7', name: 'Owned', ...media, ...overrides });
const created = (contract = CONTRACT_B, overrides = {}) => ({ id: id(contract), chainId: 42, contractAddress: contract,
  tokenId: null, standard: 'LSP7', name: 'Created', creators: [{ address: PROFILE, name: 'Creator' }],
  viewedProfileIsCreator: true, creatorAttributionLevel: 'contract', ownershipKnown: true,
  isOwnedByViewedProfile: false, ...media, ...overrides });

test('projects owned-only and strong created-only records with honest relationships', () => {
  const createdOnly = created(); const before = structuredClone(createdOnly);
  const result = projectLibraryAssetUnion({ ownedAssets: [owned()], createdAssets: [createdOnly], profileAddress: PROFILE });
  assert.equal(result.assets.length, 2);
  assert.deepEqual(result.assets.map(({ owned: isOwned, created: isCreated }) => [isOwned, isCreated]), [[true, false], [false, true]]);
  const projected = result.assets.find((asset) => asset.stableAssetId === id(CONTRACT_B));
  assert.equal(projected.isOwnedByViewedProfile, false);
  assert.equal(projected.currentOwnerAddress, null);
  assert.equal(Object.hasOwn(projected.assetRecord, 'ownerAddress'), false);
  assert.deepEqual(createdOnly, before);
});

test('deduplicates exact canonical stable IDs and retains authoritative ownership plus creator provenance', () => {
  const result = projectLibraryAssetUnion({
    ownedAssets: [owned(CONTRACT_A, { name: 'Authoritative owned', imageWidth: 2000 })],
    createdAssets: [created(CONTRACT_A, { name: 'Weaker created', imageWidth: 400, creatorAttributionLevel: 'token' })],
    profileAddress: PROFILE,
  });
  assert.equal(result.assets.length, 1);
  assert.equal(result.assets[0].stableAssetId, id(CONTRACT_A));
  assert.equal(result.assets[0].owned, true);
  assert.equal(result.assets[0].created, true);
  assert.equal(result.records[0].name, 'Authoritative owned');
  assert.equal(result.records[0].imageWidth, 2000);
  assert.equal(result.records[0].isOwnedByViewedProfile, true);
  assert.equal(result.records[0].viewedProfileIsCreator, true);
  assert.equal(result.records[0].creatorAttributionLevel, 'token');
});

test('excludes authored, display-name-only, malformed and wrong-profile attribution without mutating inputs', () => {
  const authored = created(CONTRACT_B, { creatorAttributionLevel: 'authored' });
  const displayOnly = created(CONTRACT_A, { creators: [{ name: 'Creator' }] });
  const before = structuredClone([authored, displayOnly]);
  const result = projectLibraryAssetUnion({ createdAssets: [authored, displayOnly, { ...created(), id: 'bad' }], profileAddress: PROFILE });
  assert.deepEqual(result.assets, []);
  assert.deepEqual([authored, displayOnly], before);
});

test('relationship views can overlap categories because membership remains stable-ID based', () => {
  const result = projectLibraryAssetUnion({ ownedAssets: [owned()], createdAssets: [created(CONTRACT_A)], profileAddress: PROFILE });
  const category = { assetIds: [id(CONTRACT_A)] };
  assert.equal(result.assets[0].owned && result.assets[0].created && category.assetIds.includes(result.assets[0].stableAssetId), true);
});

test('profile A creator records are rejected immediately by a profile B projection', () => {
  const profileARecord = created();
  assert.equal(projectLibraryAssetUnion({ createdAssets: [profileARecord], profileAddress: PROFILE }).records.length, 1);
  assert.deepEqual(projectLibraryAssetUnion({ createdAssets: [profileARecord],
    profileAddress: '0x2222222222222222222222222222222222222222' }).records, []);
});

test('accepts collection-derived tokens without claiming direct token creation', () => {
  const child = created(CONTRACT_B, {
    id: tokenId(CONTRACT_B), tokenId: '0x01', standard: 'LSP8', isCollection: false,
    creators: [{ address: '0x3333333333333333333333333333333333333333' }],
    viewedProfileIsCreator: false, creatorAttributionLevel: null,
    collectionCreators: [{ address: PROFILE }], viewedProfileIsCollectionCreator: true,
    collectionCreatorAttributionLevel: 'contract',
  });
  const result = projectLibraryAssetUnion({ createdAssets: [child], profileAddress: PROFILE });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].viewedProfileIsCreator, false);
  assert.equal(result.assets[0].creatorRelationship, 'collection');
  assert.equal(result.assets[0].created, true);
  assert.equal(projectLibraryAssetUnion({ createdAssets: [child], profileAddress: '0x4444444444444444444444444444444444444444' }).records.length, 0);
});


test('merges the same preview from IPFS and the verified image gateway without merging distinct attachments', () => {
  const cid = 'QmR5biKn8HUNbmE6uZFSfLBTBst1HaxCFGfJBNy84wiqLh';
  const preview = 'https://api.universalprofile.cloud/ipfs/' + cid + '/images-0-1800x1800';
  const indexed = 'https://api.universalprofile.cloud/image/' + cid + '/images-0-1800x1800?method=keccak256(bytes)&data=0x123';
  const result = projectLibraryAssetUnion({ profileAddress: PROFILE,
    ownedAssets: [owned(CONTRACT_A, { imageGroups: [{ index: 0, imageUrl: preview }] })],
    createdAssets: [created(CONTRACT_A, { imageGroups: [{ index: 0, imageUrl: indexed },
      { index: 1, imageUrl: 'https://art.test/gray.webp' }, { index: 2, imageUrl: 'https://art.test/purple.webp' }] })],
  });
  assert.equal(result.records[0].imageGroups.length, 3);
});

test('fresh direct token images replace stale owned media without changing ownership', () => {
  const images = [{ index: 0, imageUrl: 'https://art.test/new-preview.webp' },
    { index: 1, imageUrl: 'https://art.test/gray.webp' }, { index: 2, imageUrl: 'https://art.test/purple.webp' }];
  const provenance = { scope: 'tokenId', source: 'LSP4MetadataForTokenId (DIRECT LUKSO RPC)' };
  const result = projectLibraryAssetUnion({ profileAddress: PROFILE,
    ownedAssets: [owned(CONTRACT_A, { imageGroups: [{ index: 0, imageUrl: 'https://art.test/old.webp' }] })],
    createdAssets: [created(CONTRACT_A, { imageGroups: images, fieldProvenance: { images: provenance } })],
  });
  assert.deepEqual(result.records[0].imageGroups, images);
  assert.deepEqual(result.records[0].fieldProvenance.images, provenance);
  assert.equal(result.records[0].isOwnedByViewedProfile, true);
});
