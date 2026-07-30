import assert from 'node:assert/strict';
import test from 'node:test';
import { createProfileContractFacts, resolvedContractFact } from '../domain/profileContractFacts.js';
import { ProfileContractFactsCache } from './profileContractFactsCache.js';

const FIRST = '0x1234567890abcdef1234567890abcdef12345678';
const SECOND = '0x2234567890abcdef1234567890abcdef12345678';
const resolved = (address, count) => createProfileContractFacts(address, {
  chain: resolvedContractFact(42), receivedAssetContracts: resolvedContractFact(count)
});

test('deduplicates profile-scoped reads and never shares facts between addresses', async () => {
  let calls = 0;
  const cache = new ProfileContractFactsCache({ repository: { resolve: async (address) => { calls += 1; return resolved(address, address === FIRST ? 1 : 2); } } });
  const one = cache.resolve(FIRST); const duplicate = cache.resolve(FIRST);
  assert.strictEqual(one, duplicate);
  await one; await cache.resolve(SECOND);
  assert.equal(calls, 2);
  assert.equal(cache.get(FIRST).receivedAssetContracts.value, 1);
  assert.equal(cache.get(SECOND).receivedAssetContracts.value, 2);
});

test('aborts an in-flight request when its profile has no subscribers', async () => {
  let observedAbort = false;
  const cache = new ProfileContractFactsCache({ repository: { resolve: (address, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { observedAbort = true; reject(new DOMException('Aborted', 'AbortError')); });
  }) } });
  const unsubscribe = cache.subscribe(FIRST, () => {});
  const pending = cache.resolve(FIRST);
  unsubscribe(); await pending;
  assert.equal(observedAbort, true);
  assert.equal(cache.get(FIRST).receivedAssetContracts.value, null);
});
