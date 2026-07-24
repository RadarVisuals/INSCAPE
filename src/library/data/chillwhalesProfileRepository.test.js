import assert from 'node:assert/strict';
import test from 'node:test';
import { createChillwhalesProfileRepository } from './chillwhalesProfileRepository.js';

const profile = '0xf3c189819fd5b042f692983bfbfd57ab607ee709';
const lsp7 = '0x1111111111111111111111111111111111111111';
const collection = '0x2222222222222222222222222222222222222222';

function metadata({ name, description, image, index = 0, attributes = [] } = {}) {
  return {
    name: name ? { value: name } : null,
    description: description ? { value: description } : null,
    images: image ? [{ image_index: index, url: image, width: 1024, height: 768 }] : [],
    icon: [], assets: [], attributes, decode_error: null,
    fetch_error_code: null, fetch_error_message: null, fetch_error_status: null
  };
}

function response(data) {
  return { ok: true, json: async () => ({ data }) };
}

test('combines contract assets with individual LSP8 tokens without returning collection wrappers', async () => {
  const requests = [];
  const repository = createChillwhalesProfileRepository({
    endpoint: 'https://indexer.example/v1/graphql',
    ipfsGateway: 'https://gateway.example/ipfs',
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return response({
        owned_asset: [{ id: `${profile}:${lsp7}`, address: lsp7, owner: profile, balance: '1',
          tokenIds_aggregate: { aggregate: { count: 0 } }, digitalAsset: {
            address: lsp7, lsp4TokenName: { value: 'Signal' }, lsp4TokenSymbol: { value: 'SIG' },
            lsp4TokenType: { value: 'NFT' }, totalSupply: { value: '1' }, lsp4Creators: [],
            lsp4Metadata: metadata({ description: 'Contract artwork', image: 'ipfs://QmSignal/image.webp' })
          } },
        { id: `${profile}:${collection}`, address: collection, owner: profile, balance: '1',
          tokenIds_aggregate: { aggregate: { count: 1 } }, digitalAsset: {
            address: collection, lsp4TokenName: { value: 'Keepers' }, lsp4TokenSymbol: { value: 'KEEP' },
            lsp4TokenType: { value: 'COLLECTION' }, totalSupply: { value: '10' },
            lsp4Creators: [{ creator_address: profile,
              creatorProfile: { address: profile, lsp3Profile: { name: { value: 'VXCTXR' } } } }],
            lsp4Metadata: metadata({ description: 'Collection metadata' })
          } }],
        owned_asset_aggregate: { aggregate: { count: 2 } },
        owned_token: [{ id: `${profile}:${collection}:0xab`, address: collection, owner: profile, token_id: '0xAB',
          digitalAsset: {
            address: collection, lsp4TokenName: { value: 'Keepers' }, lsp4TokenSymbol: { value: 'KEEP' },
            lsp4TokenType: { value: 'COLLECTION' }, totalSupply: { value: '10' },
            lsp4Creators: [{ creator_address: profile,
              creatorProfile: { address: profile, lsp3Profile: { name: { value: 'VXCTXR' } } } }],
            lsp4Metadata: metadata({ description: 'Collection metadata' })
          }, nft: { formatted_token_id: '171',
            lsp4Metadata: metadata({ name: 'Keeper 171', description: 'Token artwork',
              image: 'ipfs://QmKeeper/token.webp', attributes: [{ key: 'Eyes', value: 'Many', type: 'string' }] }),
            lsp4MetadataBaseUri: null }
        }],
        owned_token_aggregate: { aggregate: { count: 1 } }
      });
    }
  });

  const batches = [];
  for await (const batch of repository.loadProfileAssets(profile)) batches.push(batch);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].variables.owner, profile);
  assert.equal(batches[0].complete, true);
  assert.equal(batches[0].assets.length, 2);
  assert.equal(batches[0].resolved, 2);
  assert.equal(batches[0].total, 2);
  const contractAsset = batches[0].assets.find((asset) => asset.contractAddress === lsp7);
  const token = batches[0].assets.find((asset) => asset.tokenId === '0xab');
  assert.equal(contractAsset.name, 'Signal');
  assert.equal(contractAsset.standard, 'LSP7');
  assert.equal(contractAsset.imageUrl, 'https://gateway.example/ipfs/QmSignal/image.webp');
  assert.equal(token.name, 'Keeper 171');
  assert.equal(token.collectionName, 'Keepers');
  assert.equal(token.standard, 'LSP8');
  assert.equal(token.imageUrl, 'https://gateway.example/ipfs/QmKeeper/token.webp');
  assert.deepEqual(token.attributes, [{ key: 'Eyes', value: 'Many', type: 'string' }]);
  assert.deepEqual(token.creators, [{ address: profile, name: 'VXCTXR' }]);
});

test('uses base URI metadata when direct token metadata is empty and counts missing media as a failure', async () => {
  const repository = createChillwhalesProfileRepository({ fetchImpl: async () => response({
    owned_asset: [], owned_asset_aggregate: { aggregate: { count: 0 } },
    owned_token: [{ id: 'owned', address: collection, owner: profile, token_id: '0x01',
      digitalAsset: { address: collection, lsp4TokenName: { value: 'Collection' },
        lsp4TokenType: { value: 'COLLECTION' }, lsp4Creators: [], lsp4Metadata: metadata() },
      nft: { formatted_token_id: '1', lsp4Metadata: metadata(),
        lsp4MetadataBaseUri: metadata({ name: 'Base token', description: 'Resolved from base URI' }) } }],
    owned_token_aggregate: { aggregate: { count: 1 } }
  }) });
  const batches = [];
  for await (const batch of repository.loadProfileAssets(profile)) batches.push(batch);
  assert.equal(batches[0].assets.length, 0);
  assert.equal(batches[0].failures, 1);
  assert.deepEqual(batches[0].unresolvedAssetIds, [`42:${collection}:0x01`]);
  assert.equal(batches[0].complete, true);
});

test('merges direct token text with base URI media and accepts image assets as a media fallback', async () => {
  const direct = metadata({ name: 'Direct name' });
  const base = metadata({ description: 'Base description', image: 'ipfs://QmBase/image.webp' });
  const repository = createChillwhalesProfileRepository({
    ipfsGateway: 'https://gateway.example/ipfs',
    fetchImpl: async () => response({
      owned_asset: [], owned_asset_aggregate: { aggregate: { count: 0 } },
      owned_token: [{ id: 'owned', address: collection, owner: profile, token_id: '0x02',
        digitalAsset: { address: collection, lsp4TokenName: { value: 'Collection' },
          lsp4TokenType: { value: 'COLLECTION' }, lsp4Creators: [], lsp4Metadata: metadata() },
        nft: { formatted_token_id: '2', lsp4Metadata: direct, lsp4MetadataBaseUri: base } }],
      owned_token_aggregate: { aggregate: { count: 1 } }
    })
  });
  const batches = [];
  for await (const batch of repository.loadProfileAssets(profile)) batches.push(batch);
  assert.equal(batches[0].assets[0].name, 'Direct name');
  assert.equal(batches[0].assets[0].description, 'Base description');
  assert.equal(batches[0].assets[0].imageUrl, 'https://gateway.example/ipfs/QmBase/image.webp');

  direct.images = [];
  direct.assets = [{ url: 'ipfs://QmAsset/fallback.webp', file_type: 'image/webp' }];
  base.images = [];
  const assetBatches = [];
  for await (const batch of repository.loadProfileAssets(profile)) assetBatches.push(batch);
  assert.equal(assetBatches[0].assets[0].imageUrl, 'https://gateway.example/ipfs/QmAsset/fallback.webp');
});
