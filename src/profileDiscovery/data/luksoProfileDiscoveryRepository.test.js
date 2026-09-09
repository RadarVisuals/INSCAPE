import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeDataSourceWithHash } from '@erc725/erc725.js';
import { createLuksoProfileDiscoveryRepository, PROFILE_DIRECTORY_IDENTITIES_QUERY, PROFILE_DIRECTORY_QUERY } from './luksoProfileDiscoveryRepository.js';
import { INSCAPE_PROFILE_DOCUMENT_KEY } from '../../profileDocument/domain/inscapeProfileDocumentKey.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const POINTER = '0x00006f357c6a00209f75520cb8e0125815b6e5c6cfb0b1b12a0c12558002fa9496871e8b3ef4b6ad697066733a2f2f6261666b726569636869726f7234776764727374687574336776373376756f333665666e6b6767776d70647768796668746778357664366a646875';

test('lists current INSCAPE publication events and joins their indexed profile identities', async () => {
  const requests = [];
  const repository = createLuksoProfileDiscoveryRepository({
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body); requests.push(request);
      return request.query === PROFILE_DIRECTORY_QUERY
        ? { ok: true, json: async () => ({ data: { DataChanged: [{ address: PROFILE, value: POINTER, blockNumber: 42, transactionHash: `0x${'a'.repeat(64)}` }] } }) }
        : { ok: true, json: async () => ({ data: { Profile: [{ id: PROFILE, name: 'Alice', fullName: null, profileImages: [] }] } }) };
    }
  });
  const results = await repository.list();
  assert.match(PROFILE_DIRECTORY_QUERY, /DataChanged/);
  assert.match(PROFILE_DIRECTORY_IDENTITIES_QUERY, /Profile\(where:/);
  assert.equal(requests[0].variables.key, INSCAPE_PROFILE_DOCUMENT_KEY);
  assert.equal(requests[0].variables.offset, 0);
  assert.deepEqual(requests[1].variables.addresses, [PROFILE]);
  assert.equal(results[0].address, PROFILE);
  assert.equal(results[0].status, 'PUBLISHED');
  assert.equal(results[0].publicationBlock, 42);
});

test('cleared or malformed publication pointers never enter the directory', async () => {
  let calls = 0;
  const repository = createLuksoProfileDiscoveryRepository({
    fetchImpl: async () => { calls += 1; return { ok: true, json: async () => ({ data: { DataChanged: [
      { address: PROFILE, value: '0x', blockNumber: 43 },
      { address: '0x2222222222222222222222222222222222222222', value: '0x1234', blockNumber: 42 }
    ] } }) }; }
  });
  assert.deepEqual(await repository.list(), []);
  assert.equal(calls, 1, 'identity lookup is skipped when no current pointer is valid');
});

test('structurally valid non-IPFS pointers never enter the directory', async () => {
  const unsupported = encodeDataSourceWithHash({ method: 'keccak256(utf8)', data: `0x${'11'.repeat(32)}` },
    'https://example.test/profile.json');
  const repository = createLuksoProfileDiscoveryRepository({ fetchImpl: async () => ({ ok: true,
    json: async () => ({ data: { DataChanged: [{ address: PROFILE, value: unsupported, blockNumber: 44 }] } }) }) });
  assert.deepEqual(await repository.list(), []);
});

test('IPFS pointers with malformed CIDs or paths never enter the directory', async () => {
  const addresses = ['0x2222222222222222222222222222222222222222', '0x3333333333333333333333333333333333333333',
    '0x4444444444444444444444444444444444444444'];
  const values = ['ipfs://not-a-cid', 'ipfs://bafy-profile', 'ipfs://bafkreiabc/profile.json'].map((uri) =>
    encodeDataSourceWithHash({ method: 'keccak256(utf8)', data: `0x${'22'.repeat(32)}` }, uri));
  let calls = 0;
  const repository = createLuksoProfileDiscoveryRepository({ fetchImpl: async () => {
    calls += 1;
    return { ok: true, json: async () => ({ data: { DataChanged: values.map((value, index) => ({
      address: addresses[index], value, blockNumber: 45 - index
    })) } }) };
  } });
  assert.deepEqual(await repository.list(), []);
  assert.equal(calls, 1, 'identity lookup is skipped when every CID is invalid');
});

test('retrieves every directory page and identity batch without a silent first-page cap', async () => {
  const second = '0x2222222222222222222222222222222222222222'; const offsets = [];
  const publications = [{ address: PROFILE, value: POINTER, blockNumber: 42 },
    { address: second, value: POINTER, blockNumber: 41 }];
  const repository = createLuksoProfileDiscoveryRepository({ directoryPageSize: 1,
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body);
      if (request.query === PROFILE_DIRECTORY_QUERY) {
        offsets.push(request.variables.offset);
        const publication = publications[request.variables.offset];
        return { ok: true, json: async () => ({ data: { DataChanged: publication ? [publication] : [] } }) };
      }
      const address = request.variables.addresses[0];
      return { ok: true, json: async () => ({ data: { Profile: [{ id: address, name: address === PROFILE ? 'First' : 'Second', profileImages: [] }] } }) };
    } });
  const results = await repository.list();
  assert.deepEqual(offsets, [0, 1, 2]);
  assert.deepEqual(results.map((profile) => profile.address), [PROFILE, second]);
});

test('passes abort signals to directory requests', async () => {
  const controller = new AbortController();
  const repository = createLuksoProfileDiscoveryRepository({
    fetchImpl: async (_url, options) => {
      assert.equal(options.signal, controller.signal);
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }
  });
  controller.abort();
  await assert.rejects(repository.list({ signal: controller.signal }), { name: 'AbortError' });
});
