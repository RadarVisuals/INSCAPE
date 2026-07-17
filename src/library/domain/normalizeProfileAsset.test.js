import assert from 'node:assert/strict';
import test from 'node:test';
import { createStableAssetId, normalizeProfileAsset } from './normalizeProfileAsset.js';

const owner = '0xf3c189819fd5b042f692983bfbfd57ab607ee709';
const contract = '0x1111111111111111111111111111111111111111';

test('stable asset IDs normalize addresses and distinguish token IDs', () => {
  assert.equal(createStableAssetId({ contractAddress: contract.toUpperCase().replace('0X', '0x') }), `42:${contract}:contract`);
  assert.equal(createStableAssetId({ contractAddress: contract, tokenId: '0xAB' }), `42:${contract}:0xab`);
});

test('normalizes an identifiable LSP8 holding into the internal asset model', () => {
  const asset = normalizeProfileAsset({ id: 'holding', balance: '1', token: {
    tokenId: '0xAB', name: 'Specimen', description: 'A test asset',
    images: [{ url: 'ipfs://QmAsset/image.png', width: 800 }],
    lsp4Creators: [{ profile_id: owner, profile: { name: 'Creator' } }],
    asset: { id: contract, name: 'Collection', isLSP7: false }
  } }, owner, { ipfsGateway: 'https://gateway.example/ipfs' });
  assert.equal(asset.id, `42:${contract}:0xab`);
  assert.equal(asset.standard, 'LSP8');
  assert.equal(asset.collectionName, 'Collection');
  assert.equal(asset.imageUrl, 'https://gateway.example/ipfs/QmAsset/image.png');
  assert.deepEqual(asset.creators[0], { address: owner, name: 'Creator' });
});
