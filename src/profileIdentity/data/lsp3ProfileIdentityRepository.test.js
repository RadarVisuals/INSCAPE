import assert from 'node:assert/strict';
import test from 'node:test';
import { createLsp3ProfileIdentityRepository } from './lsp3ProfileIdentityRepository.js';

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
const makeRepository = (erc725, codeReader = async () => '0x6000') => createLsp3ProfileIdentityRepository({ erc725Factory: () => erc725, codeReader, ipfsGateway: 'https://gw.test/ipfs/' });

test('resolves and normalizes verified LSP3 profile metadata', async () => {
  const repository = makeRepository({ supportsInterface: async () => true, fetchData: async () => ({ value: { LSP3Profile: {
    name: 'RADAR', description: 'Live bio', profileImage: [{ url: 'ipfs://avatar', width: 96 }],
    tags: ['art'], links: [{ title: 'Home', url: 'ipfs://home' }]
  } } }) });
  const identity = await repository.resolve(ADDRESS);
  assert.equal(identity.name, 'RADAR');
  assert.equal(identity.description, 'Live bio');
  assert.equal(identity.avatarUrl, 'https://gw.test/ipfs/avatar');
  assert.deepEqual(identity.tags, ['art']);
  assert.equal(identity.links[0].url, 'https://gw.test/ipfs/home');
  assert.equal(identity.isUniversalProfile, true);
});

test('distinguishes non-profiles, missing metadata, malformed data, and network failure', async () => {
  assert.equal((await makeRepository({}, async () => '0x').resolve(ADDRESS)).errorCode, 'NOT_UNIVERSAL_PROFILE');
  assert.equal((await makeRepository({ supportsInterface: async () => false }).resolve(ADDRESS)).errorCode, 'NOT_UNIVERSAL_PROFILE');
  assert.equal((await makeRepository({ supportsInterface: async () => true, fetchData: async () => ({ value: null }) }).resolve(ADDRESS)).errorCode, 'METADATA_UNAVAILABLE');
  assert.equal((await makeRepository({ supportsInterface: async () => true, fetchData: async () => ({ value: { LSP3Profile: 'bad' } }) }).resolve(ADDRESS)).errorCode, 'MALFORMED_METADATA');
  assert.equal((await makeRepository({ supportsInterface: async () => { throw new Error('RPC unavailable'); } }).resolve(ADDRESS)).status, 'ERROR');
});

test('rejects invalid addresses and protects aborted results', async () => {
  await assert.rejects(() => makeRepository({}).resolve('bad'), TypeError);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => makeRepository({}).resolve(ADDRESS, { signal: controller.signal }), /Abort/);
});
