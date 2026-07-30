import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeDataSourceWithHash } from '@erc725/erc725.js';
import { createLuksoRpcProfileRepository } from './luksoRpcProfileRepository.js';

const profile = '0x84841412e9f66e360c6da5f9dba11b8e88d87ea8';
const lsp8 = '0x1111111111111111111111111111111111111111';
const lsp7 = '0x2222222222222222222222222222222222222222';
const tokenId = `0x${'0'.repeat(63)}1`;
const hash = `0x${'0'.repeat(64)}`;
const uri = (name) => encodeDataSourceWithHash({ method: 'keccak256(bytes)', data: hash }, `ipfs://${name}`);

function response(body) {
  return { ok: true, headers: { get: () => 'application/json' }, json: async () => body };
}

test('discovers LSP5 contracts, verifies direct ownership and normalizes LSP7 and LSP8 metadata', async () => {
  let multicallCount = 0;
  const client = {
    async multicall({ contracts }) {
      multicallCount += 1;
      if (contracts[0]?.functionName === 'supportsInterface') {
        return [
          { status: 'success', result: true }, { status: 'success', result: false },
          { status: 'success', result: false }, { status: 'success', result: true }
        ];
      }
      return [
        { status: 'success', result: [tokenId] },
        { status: 'success', result: 5n }
      ];
    },
    async readContract({ address, functionName }) {
      if (functionName === 'getDataForTokenId') return uri('token');
      if (functionName === 'getData' && address.toLowerCase() === lsp8) return uri('collection8');
      if (functionName === 'getData' && address.toLowerCase() === lsp7) return uri('collection7');
      return '0x';
    }
  };
  const documents = {
    token: { LSP4Metadata: { name: 'Token One', description: 'Token description',
      images: [[{ url: 'ipfs://token-image', width: 900, height: 1200 }]],
      attributes: [{ key: 'Signal', value: 'High' }] } },
    collection8: { LSP4Metadata: { name: 'Test Collection' } },
    collection7: { LSP4Metadata: { name: 'Test Currency', description: 'A direct LSP7 asset',
      images: [[{ url: 'ipfs://currency-image', width: 600, height: 600 }]] } }
  };
  const repository = createLuksoRpcProfileRepository({
    client, rpcUrl: 'https://rpc.example', ipfsGateway: 'https://gateway.example/ipfs/',
    discoverContracts: async (address) => {
      assert.equal(address, profile);
      return [lsp8, lsp7];
    },
    fetchImpl: async (url) => response(documents[url.split('/').at(-1)])
  });
  const batches = [];
  for await (const batch of repository.loadProfileAssets(profile)) batches.push(batch);
  assert.equal(multicallCount, 2);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].complete, true);
  assert.equal(batches[0].total, 2);
  assert.equal(batches[0].failures, 0);
  const [token, currency] = batches[0].assets;
  assert.equal(token.id, `42:${lsp8}:${tokenId}`);
  assert.equal(token.standard, 'LSP8');
  assert.equal(token.name, 'Token One');
  assert.equal(token.collectionName, 'Test Collection');
  assert.equal(token.imageUrl, 'https://gateway.example/ipfs/token-image');
  assert.deepEqual(token.attributes, [{ key: 'Signal', value: 'High', type: null }]);
  assert.equal(currency.id, `42:${lsp7}:contract`);
  assert.equal(currency.standard, 'LSP7');
  assert.equal(currency.name, 'Test Currency');
  assert.equal(currency.imageUrl, 'https://gateway.example/ipfs/currency-image');
});

test('emits a complete empty batch when LSP5 contains no currently owned assets', async () => {
  const repository = createLuksoRpcProfileRepository({
    client: { multicall: async () => [], readContract: async () => '0x' },
    rpcUrl: 'https://rpc.example', discoverContracts: async () => [], fetchImpl: async () => response({})
  });
  const batches = [];
  for await (const batch of repository.loadProfileAssets(profile)) batches.push(batch);
  assert.deepEqual(batches, [{ assets: [], resolved: 0, total: 0, failures: 0, complete: true }]);
});

test('hydrates gallery-referenced assets before the remaining RPC inventory', async () => {
  const secondTokenId = `0x${'0'.repeat(63)}2`;
  const client = {
    async multicall({ contracts }) {
      if (contracts[0]?.functionName === 'supportsInterface') {
        return [{ status: 'success', result: true }, { status: 'success', result: false }];
      }
      return [{ status: 'success', result: [tokenId, secondTokenId] }];
    },
    async readContract({ functionName, args }) {
      if (functionName === 'getDataForTokenId') return uri(args[0] === secondTokenId ? 'token-two' : 'token-one');
      if (functionName === 'getData') return uri('collection8');
      return '0x';
    }
  };
  const documents = {
    'token-one': { LSP4Metadata: { name: 'Token One', images: [{ url: 'ipfs://one' }] } },
    'token-two': { LSP4Metadata: { name: 'Token Two', images: [{ url: 'ipfs://two' }] } },
    collection8: { LSP4Metadata: { name: 'Collection' } }
  };
  const repository = createLuksoRpcProfileRepository({ client, rpcUrl: 'https://rpc.example', pageSize: 1,
    discoverContracts: async () => [lsp8], fetchImpl: async (url) => response(documents[url.split('/').at(-1)]) });
  const priorityId = `42:${lsp8}:${secondTokenId}`;
  const batches = [];
  for await (const batch of repository.loadProfileAssets(profile, { priorityAssetIds: [priorityId] })) batches.push(batch);
  assert.equal(batches[0].assets[0].id, priorityId);
  assert.equal(batches[1].assets[0].id, `42:${lsp8}:${tokenId}`);

  const requestedBatches = [];
  for await (const batch of repository.loadProfileAssets(profile,
    { requestedAssetIds: [`42:${lsp8}:${tokenId}`] })) requestedBatches.push(batch);
  assert.equal(requestedBatches.length, 1);
  assert.equal(requestedBatches[0].total, 1);
  assert.equal(requestedBatches[0].assets[0].id, `42:${lsp8}:${tokenId}`);
});

test('a stalled metadata host cannot block completion of the RPC inventory', async () => {
  const client = {
    async multicall({ contracts }) {
      if (contracts[0]?.functionName === 'supportsInterface') {
        return [{ status: 'success', result: false }, { status: 'success', result: true }];
      }
      return [{ status: 'success', result: 1n }];
    },
    async readContract() { return uri('stalled'); }
  };
  const repository = createLuksoRpcProfileRepository({ client, rpcUrl: 'https://rpc.example', metadataResponseMs: 5,
    discoverContracts: async () => [lsp7], fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }) });
  const batches = [];
  for await (const batch of repository.loadProfileAssets(profile)) batches.push(batch);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].complete, true);
  assert.equal(batches[0].failures, 1);
});

test('preserves an arbitrary bytes32 token id in token-specific base metadata and reads contract LSP4 facts', async () => {
  const mixedTokenId = `0x${Buffer.from('mixed-token-id').toString('hex').padEnd(64, '0')}`;
  const creator = '0x3333333333333333333333333333333333333333';
  const client = {
    async multicall({ contracts }) {
      if (contracts[0]?.functionName === 'supportsInterface') {
        return [{ status: 'success', result: true }, { status: 'success', result: false }];
      }
      return [{ status: 'success', result: [mixedTokenId] }];
    },
    async readContract({ functionName, args }) {
      if (functionName === 'getDataForTokenId') {
        if (args[1] === '0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e') return '0x';
        return uri('token-base');
      }
      if (args[0] === '0xe0261fa95db2eb3b5439bd033cda66d56b96f92f243a8228fd87550ed7bdfdb3') return '0x02';
      if (args[0] === '0x114bd03b3a46d48759680d81ebb2b414fda7d030a7105a851867accf1c2352e7') return '0x01';
      if (args[0].startsWith('0x114bd03b3a46d48759680d81ebb2b414')) return creator;
      return uri('collection8');
    }
  };
  const repository = createLuksoRpcProfileRepository({ client, rpcUrl: 'https://rpc.example',
    discoverContracts: async () => [lsp8], fetchImpl: async (url) => response(
      url.includes(mixedTokenId) ? { LSP4Metadata: { name: 'Mixed token', images: [{ url: 'ipfs://mixed' }] } }
        : { LSP4Metadata: { name: 'Collection' } },
    ) });
  const batches = [];
  for await (const batch of repository.loadProfileAssets(profile)) batches.push(batch);
  const asset = batches[0].assets[0];
  assert.equal(asset.tokenId, mixedTokenId);
  assert.equal(asset.name, 'Mixed token');
  assert.equal(asset.tokenType, 'COLLECTION');
  assert.deepEqual(asset.creators, [{ address: creator, name: null }]);
  assert.deepEqual(asset.fieldProvenance.name, { scope: 'tokenId', source: 'LSP8TokenMetadataBaseURIForTokenId' });
});

test('decodes a numeric LSP8 token id before concatenating a metadata base URI', async () => {
  const fetched = [];
  const client = {
    async multicall({ contracts }) {
      if (contracts[0]?.functionName === 'supportsInterface') {
        return [{ status: 'success', result: true }, { status: 'success', result: false }];
      }
      return [{ status: 'success', result: [tokenId] }];
    },
    async readContract({ functionName, args }) {
      if (functionName === 'getDataForTokenId') return '0x';
      if (args[0] === '0xf675e9361af1c1664c1868cfa3eb97672d6b1a513aa5b81dec34c9ee330e818d') return '0x00';
      if (args[0] === '0x1a7628600c3bac7101f53697f48df381ddc36b9015e7d7c9c5633d1252aa2843') return uri('metadata/');
      if (args[0] === '0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e') return uri('collection8');
      return '0x';
    }
  };
  const repository = createLuksoRpcProfileRepository({ client, rpcUrl: 'https://rpc.example',
    discoverContracts: async () => [lsp8], fetchImpl: async (url) => {
      fetched.push(url);
      return response(url.endsWith('/metadata/1') ? { LSP4Metadata: { name: 'Numeric token',
        images: [{ url: 'ipfs://numeric' }], attributes: [{ trait_type: 'Rank', value: 281, type: 'number' }] } }
        : { LSP4Metadata: { name: 'Collection' } });
    } });
  const batches = [];
  for await (const batch of repository.loadProfileAssets(profile)) batches.push(batch);
  assert.equal(fetched.some((url) => url.endsWith('/metadata/1')), true);
  assert.equal(batches[0].assets[0].name, 'Numeric token');
  assert.deepEqual(batches[0].assets[0].attributes, [{ key: 'Rank', value: 281, type: 'number' }]);
});
