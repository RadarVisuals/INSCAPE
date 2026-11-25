import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeAbiParameters, toHex } from 'viem';
import { createLuksoProfileContractRepository } from './luksoProfileContractRepository.js';

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

function makeRepository(overrides = {}) {
  return createLuksoProfileContractRepository({
    fetchImpl: async (_, { body }) => {
      const data = JSON.parse(body).params[0].data;
      assert.equal(data.length, 74);
      const value = toHex(data.includes('6460ee3c') ? 2 : 1, {size:16});
      return {ok:true, json:async () => ({result:encodeAbiParameters([{type:'bytes'}], [value])})};
    },
    chainReader: async () => 42,
    erc725Factory: () => ({ supportsInterface: async () => true }),
    ...overrides
  });
}

test('resolves active chain, LSP0, and exact LSP5/LSP12 register lengths independently', async () => {
  const facts = await makeRepository().resolve(ADDRESS);
  assert.equal(facts.chain.value, 42);
  assert.equal(facts.isUniversalProfile.value, true);
  assert.equal(facts.receivedAssetContracts.value, 2);
  assert.equal(facts.issuedAssetContracts.value, 1);
});

test('keeps partial RPC failures unresolved rather than turning them into zero', async () => {
  const repository = makeRepository({
    fetchImpl: async (_, { body }) => {
      if (body.includes('6460ee3c')) throw Error('read failed');
      return {ok:true, json:async () => ({result:encodeAbiParameters([{type:'bytes'}], ['0x'])})};
    }
  });
  const facts = await repository.resolve(ADDRESS);
  assert.equal(facts.receivedAssetContracts.status, 'ERROR');
  assert.equal(facts.receivedAssetContracts.value, null);
  assert.equal(facts.issuedAssetContracts.status, 'RESOLVED');
  assert.equal(facts.issuedAssetContracts.value, 0);
});

test('aborts before and after direct reads and rejects malformed addresses', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() => makeRepository().resolve(ADDRESS, { signal: controller.signal }), /aborted/i);
  await assert.rejects(() => makeRepository().resolve('bad'), TypeError);
});
