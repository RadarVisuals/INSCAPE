import test from 'node:test';
import assert from 'node:assert/strict';
import { createStableAssetId } from '../../library/domain/normalizeProfileAsset.js';
import { deduplicateCreations, normalizeCollectionToken, normalizeCreatorAttribution } from './normalizeCreation.js';

const PROFILE = '0x1234567890abcdef1234567890abcdef12345678';
const OTHER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const CONTRACT = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const image = { src: 'https://example.com/art.png', url: 'ipfs://art', width: 1000, height: 1000 };

function assetRow(overrides = {}) {
  return { id: 'path-a', profile_id: PROFILE, asset_id: CONTRACT, asset: {
    id: CONTRACT, isLSP7: true, name: 'Created work', description: 'Description', images: [image], holders: [],
    lsp4Creators: [{ profile_id: PROFILE, profile: { name: 'Creator' } }, { profile_id: OTHER, profile: { name: 'Co-creator' } }],
    attributes: [], ...overrides
  } };
}

test('normalizes contract-level LSP4 attribution with Library-compatible stable identity', () => {
  const creation = normalizeCreatorAttribution(assetRow(), PROFILE);
  assert.equal(creation.id, createStableAssetId({ contractAddress: CONTRACT }));
  assert.equal(creation.creatorAttributionLevel, 'contract');
  assert.equal(creation.creators.length, 2);
  assert.equal(creation.isOwnedByViewedProfile, false);
  assert.equal(creation.ownershipKnown, true);
  assert.equal(creation.fieldProvenance.name.scope, 'contract');
  assert.equal(creation.fieldProvenance.description.scope, 'contract');
  assert.equal(creation.fieldProvenance.creators.scope, 'contract');
});

test('keeps multiple authored images separate from resolution variants and uses authored index zero as primary', () => {
  const creation = normalizeCreatorAttribution(assetRow({ images: [
    { index: 1, src: 'https://example.com/second.png', width: 2400, height: 2400 },
    { index: 0, src: 'https://example.com/first-small.png', width: 320, height: 320 },
    { index: 0, src: 'https://example.com/first-large.png', width: 1200, height: 1200 }
  ] }), PROFILE);
  assert.equal(creation.imageGroups.length, 2);
  assert.equal(creation.imageUrl, 'https://example.com/first-large.png');
  assert.equal(creation.imageGroups[0].variants.length, 2);
  assert.equal(creation.imageGroups[1].imageUrl, 'https://example.com/second.png');
});

test('normalizes token-level attribution and current viewed-profile ownership', () => {
  const tokenId = '0xCAFE';
  const row = { id: 'path-token', profile_id: PROFILE, token_id: `${CONTRACT}-${tokenId}`, token: {
    id: `${CONTRACT}-${tokenId}`, tokenId, name: 'Token work', description: 'Token description', images: [image],
    holders: [{ profile_id: PROFILE, balance: '1' }], lsp4Creators: [{ profile_id: PROFILE }], attributes: [],
    asset: { id: CONTRACT, name: 'Collection', isLSP7: false, lsp4Creators: [{ profile_id: OTHER }] }
  } };
  const creation = normalizeCreatorAttribution(row, PROFILE);
  assert.equal(creation.id, createStableAssetId({ contractAddress: CONTRACT, tokenId: tokenId.toLowerCase() }));
  assert.equal(creation.creatorAttributionLevel, 'token');
  assert.equal(creation.isOwnedByViewedProfile, true);
  assert.equal(creation.currentOwnerAddress, PROFILE);
  assert.equal(creation.fieldProvenance.name.scope, 'tokenId');
});

test('retains the indexed current holder for a creator token held by another profile', () => {
  const tokenId = '0xCAFE';
  const row = { id: 'path-token-other', profile_id: PROFILE, token_id: `${CONTRACT}-${tokenId}`, token: {
    id: `${CONTRACT}-${tokenId}`, tokenId, name: 'Released work', description: 'Now collected', images: [image],
    holders: [{ profile_id: OTHER, balance: '1' }], lsp4Creators: [{ profile_id: PROFILE }],
    attributes: [{ key: 'Medium', value: 'Digital' }], asset: { id: CONTRACT, isLSP7: false }
  } };
  const creation = normalizeCreatorAttribution(row, PROFILE);
  assert.equal(creation.isOwnedByViewedProfile, false);
  assert.equal(creation.currentOwnerAddress, OTHER);
  assert.equal(creation.fieldProvenance.attributes.scope, 'tokenId');
});

test('normalizes collection children without turning collection authorship into token authorship', () => {
  const collection = normalizeCreatorAttribution(assetRow({ isLSP7: false, isCollection: true, name: 'HALO' }), PROFILE);
  const token = normalizeCollectionToken({
    id: `${CONTRACT}-0x01`, tokenId: '0x01', name: 'HALO 01', description: 'First token', images: [image],
    holders: [{ profile_id: OTHER, balance: '1' }], lsp4Creators: [{ profile_id: OTHER }], attributes: [],
    asset: assetRow({ isLSP7: false, isCollection: true, name: 'HALO' }).asset,
  }, collection, PROFILE);
  assert.equal(collection.isCollection, true);
  assert.equal(token.viewedProfileIsCreator, false);
  assert.equal(token.creatorAttributionLevel, null);
  assert.equal(token.viewedProfileIsCollectionCreator, true);
  assert.equal(token.collectionCreatorAttributionLevel, 'contract');
  assert.deepEqual(token.creators, [{ address: OTHER, name: null }]);
  assert.equal(token.collectionCreators.some(({ address }) => address === PROFILE), true);
  assert.equal(token.currentOwnerAddress, OTHER);
  assert.equal(token.isOwnedByViewedProfile, false);
  assert.equal(token.fieldProvenance.creators.scope, 'tokenId');
  assert.equal(token.fieldProvenance.collectionCreators.scope, 'collectionContract');
});

test('collection children fail closed for another profile or a different contract', () => {
  const collection = normalizeCreatorAttribution(assetRow({ isLSP7: false, isCollection: true }), PROFILE);
  const token = { id: `${CONTRACT}-0x01`, tokenId: '0x01', images: [image], holders: [], lsp4Creators: [],
    asset: { id: CONTRACT, isCollection: true } };
  assert.equal(normalizeCollectionToken(token, collection, '0xcccccccccccccccccccccccccccccccccccccccc'), null);
  assert.equal(normalizeCollectionToken({ ...token, asset: { id: OTHER, isCollection: true } }, collection, PROFILE), null);
});

test('excludes unrelated owned assets and retains partial metadata', () => {
  assert.equal(normalizeCreatorAttribution({ ...assetRow(), profile_id: OTHER }, PROFILE), null);
  assert.equal(normalizeCreatorAttribution(assetRow({ lsp4Creators: [{ profile_id: OTHER }], holders: [{ profile_id: PROFILE, balance: '1' }] }), PROFILE), null);
  const partial = normalizeCreatorAttribution(assetRow({ images: [], description: '' }), PROFILE);
  assert.equal(partial.metadataStatus, 'partial');
  assert.equal(partial.imageUrl, null);
});

test('deduplicates duplicate query paths by chain, contract, and token identity', () => {
  const first = normalizeCreatorAttribution(assetRow(), PROFILE);
  const duplicate = { ...first, creatorAttributionLevel: 'token', creators: [{ address: PROFILE, name: 'Creator' }] };
  const result = deduplicateCreations([first, duplicate]);
  assert.equal(result.length, 1);
  assert.equal(result[0].creatorAttributionLevel, 'contract-and-token');
  assert.equal(result[0].creators.length, 2);
});
