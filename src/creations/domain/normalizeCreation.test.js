import test from 'node:test';
import assert from 'node:assert/strict';
import { createStableAssetId } from '../../library/domain/normalizeProfileAsset.js';
import { deduplicateCreations, normalizeCreatorAttribution } from './normalizeCreation.js';

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
