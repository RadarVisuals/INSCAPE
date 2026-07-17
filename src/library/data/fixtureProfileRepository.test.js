import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixtureProfileRepository } from './fixtureProfileRepository.js';

test('fixture repository emits deterministic normalized assets with explicit fixture source', async () => {
  const repository = createFixtureProfileRepository({ fetchImpl: async () => ({ ok: true, json: async () => ({ assets: [{ id: 'stable', name: 'Fixture' }] }) }) });
  const batches = [];
  for await (const batch of repository.loadProfileAssets('0xf3c189819fd5b042f692983bfbfd57ab607ee709')) batches.push(batch);
  assert.equal(repository.source, 'FIXTURE');
  assert.equal(batches[0].complete, true);
  assert.equal(batches[0].assets[0].id, 'stable');
});
