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
