import assert from 'node:assert/strict';
import test from 'node:test';
import { createStableAssetId, normalizeProfileAsset } from './normalizeProfileAsset.js';
import { buildProfileDocumentV9Asset, validateProfileDocumentV9Asset } from '../../profileDocument/domain/profileDocumentV9Asset.js';
import { createProfileDocumentV9FocusViewModel } from '../../profileDocument/components/profileDocumentV9FocusViewModel.js';

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
  assert.deepEqual(asset.fieldProvenance.creators, { scope: 'tokenId', source: 'LSP4Creators[]' });
});

test('resolved creators survive publication and Visitor metadata independently of image metadata provenance', () => {
  for (const scope of ['contract', 'tokenId']) {
    const creator = { profile_id: owner, profile: { name: 'Creator' } };
    const base = { id: contract, name: 'Collection', metadataSource: 'LSP4Metadata',
      lsp4Creators: [creator], images: [{ url: 'https://assets.example/art.png', width: 800, height: 800 }] };
    const token = { tokenId: '0xab', name: 'Artwork', asset: base,
      metadataSource: 'LSP4MetadataForTokenId (DIRECT LUKSO RPC)',
      lsp4Creators: scope === 'tokenId' ? [creator] : [] };
    const asset = normalizeProfileAsset({ token }, owner);
    const published = buildProfileDocumentV9Asset(asset, asset.id);
    assert.equal(validateProfileDocumentV9Asset(published), true);
    assert.deepEqual(published.creators, [{ address: owner, name: 'Creator', source: 'LSP4Creators[]', scope }]);
    const visitor = createProfileDocumentV9FocusViewModel({ asset: published });
    assert.deepEqual(visitor.dossier.creators, published.creators);
  }
});

test('missing LSP4 creators remain unknown even when the holder and metadata are resolved', () => {
  const asset = normalizeProfileAsset({ token: { tokenId: '0xab', name: 'Artwork',
    asset: { id: contract, name: 'Collection', metadataSource: 'LSP4Metadata' } } }, owner);
  assert.deepEqual(asset.creators, []);
  assert.equal(asset.fieldProvenance.creators, null);
});

test('uses contract attributes when token-specific metadata does not publish attributes', () => {
  const asset = normalizeProfileAsset({ token: { tokenId: '0xAB', name: 'Specimen', attributes: [],
    asset: { id: contract, name: 'Collection', attributes: [{ key: 'Series', value: 'Genesis', attributeType: 'string' }] }
  } }, owner);
  assert.deepEqual(asset.attributes, [{ key: 'Series', value: 'Genesis', type: 'string' }]);
  assert.deepEqual(asset.fieldProvenance.attributes, { scope: 'contract', source: 'LSP4Metadata' });
});
