import assert from 'node:assert/strict';
import test from 'node:test';
import { projectLibraryAssetUnion } from './libraryAssetUnion.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CONTRACT_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const CONTRACT_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const id = (contract) => `42:${contract}:contract`;
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
