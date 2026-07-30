import assert from 'node:assert/strict';
import test from 'node:test';
import { createProfileContractFacts, PROFILE_CONTRACT_FACT_STATUS, resolvedContractFact } from './profileContractFacts.js';

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

test('keeps canonical address resolved while every remote fact has an independent status', () => {
  const facts = createProfileContractFacts(ADDRESS.toUpperCase().replace('0X', '0x'));
  assert.equal(facts.address.value, ADDRESS);
  assert.equal(facts.address.status, PROFILE_CONTRACT_FACT_STATUS.RESOLVED);
  assert.equal(facts.chain.status, PROFILE_CONTRACT_FACT_STATUS.IDLE);
  assert.notStrictEqual(facts.chain, facts.address);
});

test('retains an exact resolved zero without manufacturing it for unresolved facts', () => {
  const facts = createProfileContractFacts(ADDRESS, { receivedAssetContracts: resolvedContractFact(0) });
  assert.equal(facts.receivedAssetContracts.value, 0);
  assert.equal(facts.issuedAssetContracts.value, null);
  assert.equal(facts.issuedAssetContracts.status, PROFILE_CONTRACT_FACT_STATUS.IDLE);
});
