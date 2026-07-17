import assert from 'node:assert/strict';
import test from 'node:test';
import { FIXTURE_IDENTITY_ADDRESSES } from '../../profileIdentity/data/fixtureProfileIdentityRepository.js';
import { fixtureProfileIdentityCache } from '../../profileIdentity/state/profileIdentityService.js';
import { useSignalStore } from './useSignalStore.js';

const signal = Object.freeze({
  id: 'fixture-reaction', type: 'ASSET_RECEIVED', direction: 'INCOMING', timestamp: 1,
  counterparty: FIXTURE_IDENTITY_ADDRESSES.RADAR, sourceMode: 'FIXTURE', title: 'Signal'
});

test('reaction takes one bounded opportunity for cached identity without changing history', async () => {
  fixtureProfileIdentityCache.clear();
  const history = [signal];
  useSignalStore.setState({ history, queue: [signal], currentReaction: null });
  assert.equal(useSignalStore.getState().beginNextReaction(), null);
  assert.ok(useSignalStore.getState().queue[0].identityWaitUntil > Date.now());
  await fixtureProfileIdentityCache.resolve(signal.counterparty);
  const current = useSignalStore.getState().beginNextReaction();
  assert.equal(current.displayIdentity.name, 'RADAR');
  assert.strictEqual(useSignalStore.getState().history, history);
  assert.deepEqual(history[0], signal);
});

test('reaction falls back after its deadline and identity resolution does not replay it', async () => {
  const fallback = { ...signal, id: 'fallback', counterparty: FIXTURE_IDENTITY_ADDRESSES.FAILURE, identityWaitUntil: Date.now() - 1 };
  useSignalStore.setState({ history: [signal], queue: [fallback], currentReaction: null });
  const current = useSignalStore.getState().beginNextReaction();
  assert.equal(current.displayIdentity, undefined);
  await fixtureProfileIdentityCache.resolve(fallback.counterparty);
  assert.equal(useSignalStore.getState().queue.length, 0);
  assert.equal(useSignalStore.getState().currentReaction.id, 'fallback');
});
