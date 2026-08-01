import assert from 'node:assert/strict';
import test from 'node:test';
import { createLatticeProductionFocusViewModel } from './latticeProductionFocusViewModel.js';

const contract = '0x2222222222222222222222222222222222222222';
const stableAssetId = `42:${contract}:0x01`;
const placement = { id: 'placement-1', navigationOrder: 0, asset: {
  stableAssetId, network: 'lukso-mainnet', chainId: 42, tokenStandard: 'LSP8',
  contractAddress: contract, tokenId: '0x01', name: 'Published name', description: 'Published description',
  collectionName: 'Not a dossier fact', media: { url: 'https://cdn.example/art.png', width: 800, height: 600, type: 'image' },
  creators: [], attributes: [],
} };

test('focus view model exposes only resolved scoped facts and never placement presentation as NFT facts', () => {
  const model = createLatticeProductionFocusViewModel(placement, {
    id: stableAssetId, name: 'Token name', description: 'Token description', standard: 'LSP8', tokenType: 'NFT',
    imageWidth: 800, imageHeight: 600, originalImageUrl: 'https://cdn.example/original.png', mediaFileType: 'image/png',
    creators: [{ address: contract, name: 'Creator' }], attributes: [{ key: 'Signal', value: 'High' }],
    collectionName: 'Collection', rawMetadata: { balance: '12', supply: '500', mintDate: 'invented' },
    fieldProvenance: {
      name: { scope: 'tokenId', source: 'LSP4MetadataForTokenId' },
      description: { scope: 'tokenId', source: 'LSP4MetadataForTokenId' },
      attributes: { scope: 'tokenId', source: 'LSP4MetadataForTokenId' },
      creators: { scope: 'contract', source: 'LSP4Creators[]' },
      tokenType: { scope: 'contract', source: 'LSP4TokenType' },
    },
  });
  assert.equal(model.dossier.title, 'Token name');
  assert.deepEqual(model.dossier.traits, [{ label: 'Signal', value: 'High' }]);
  const labels = model.dossier.technical.map(({ label }) => label);
  assert.deepEqual(labels, ['CREATORS / CONTRACT', 'CONTRACT', 'TOKEN ID / TOKEN', 'STANDARD / CONTRACT',
    'LSP4 TOKEN TYPE / CONTRACT', 'NETWORK', 'SOURCE DIMENSIONS', 'DECLARED FILE TYPE', 'EXPLORER / DERIVED']);
  assert.doesNotMatch(JSON.stringify(model.dossier), /collection|balance|supply|mint|edition|transparen/iu);
});

test('focus view model hides synthetic or unprovenanced metadata text', () => {
  const model = createLatticeProductionFocusViewModel(placement, {
    id: stableAssetId, name: 'Token 0x01…', description: '', standard: 'LSP8', creators: [], attributes: [],
    fieldProvenance: {},
  });
  assert.equal(model.dossier.title, null);
  assert.equal(model.dossier.description, null);
  assert.deepEqual(model.dossier.traits, []);
});

test('visitor focus view model may consume only the validated public projection', () => {
  const publicPlacement = { ...placement, asset: {
    ...placement.asset,
    creators: [{ address: contract, name: 'Published creator' }],
    attributes: [{ key: 'Signal', value: 'Public', type: 'string' }],
  } };
  const model = createLatticeProductionFocusViewModel(publicPlacement, null, { trustPublishedMetadata: true });
  assert.equal(model.dossier.title, 'Published name');
  assert.equal(model.dossier.description, 'Published description');
  assert.deepEqual(model.dossier.traits, [{ label: 'Signal', value: 'Public' }]);
  assert.match(model.dossier.technical.find(({ label }) => label === 'CREATORS / CONTRACT').value, /Published creator/);
});
