import assert from 'node:assert/strict';
import test from 'node:test';
import { createLuksoProfileContractRepository } from './luksoProfileContractRepository.js';

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

function makeRepository(overrides = {}) {
  const values = { 'LSP5ReceivedAssets[]': ['0x1', '0x2'], 'LSP12IssuedAssets[]': ['0x3'] };
  return createLuksoProfileContractRepository({
    fetchImpl: async () => ({ ok: true, json: async () => ({ result: '0x2a' }) }),
    chainReader: async () => 42,
    erc725Factory: () => ({ supportsInterface: async () => true, getData: async (key) => ({ value: values[key] }) }),
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
    erc725Factory: () => ({
      supportsInterface: async () => true,
      getData: async (key) => {
        if (key === 'LSP5ReceivedAssets[]') throw new Error('read failed');
        return { value: [] };
      }
    })
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
