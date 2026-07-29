import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLatticeProductionPublicAssetReference } from './latticeProductionPublication.js';

const reference = (overrides = {}) => ({
  stableAssetId: '42:0x2222222222222222222222222222222222222222:0x01',
  network: 'lukso-mainnet', chainId: 42, tokenStandard: 'LSP8',
  contractAddress: '0x2222222222222222222222222222222222222222', tokenId: '0x01',
  name: 'Real work', description: '', collectionName: null,
  media: { url: 'ipfs://QmYwAPJzv5CZsnAzt8auVZRnGiRA7a4Hkvp9FzWb6gQd5K/work.webp', width: 1600, height: 900, type: 'image' },
  creators: [{ address: '0x1111111111111111111111111111111111111111', name: 'Creator' }],
  attributes: [{ key: 'Edition', value: '1', type: 'string' }], ...overrides,
});

test('public asset references contain canonical real identity, safe media, native ratio, and honest metadata', () => {
  assert.equal(validateLatticeProductionPublicAssetReference(reference()), true);
  assert.equal(validateLatticeProductionPublicAssetReference(reference({ stableAssetId: 'owned-asset-1' })), false);
  assert.equal(validateLatticeProductionPublicAssetReference(reference({ media: { url: 'javascript:alert(1)', width: 1, height: 1, type: 'image' } })), false);
  assert.equal(validateLatticeProductionPublicAssetReference(reference({ creators: [{ address: 'not-an-address', name: 'Invented' }] })), false);
  assert.equal(validateLatticeProductionPublicAssetReference(reference({ media: { url: 'https://cdn.example/work.webp', width: null, height: null, type: 'unknown' } })), true);
});
