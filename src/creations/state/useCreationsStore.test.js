import test from 'node:test';
import assert from 'node:assert/strict';
import { useLibraryStore } from '../../library/state/useLibraryStore.js';
import { createCreationsStore } from './useCreationsStore.js';

const PROFILE_A = '0x1234567890abcdef1234567890abcdef12345678';
const PROFILE_B = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

const asset = (id, profile) => ({ id, creators: [{ address: profile }], imageUrl: null, metadataStatus: 'partial' });
const emptyFixture = { source: 'FIXTURE', async *loadCreations() { yield { assets: [], resolved: 0, total: 0, failures: 0, complete: true }; } };

test('Creations store remains isolated from Library state', async () => {
  const libraryBefore = useLibraryStore.getState().assets;
  const liveRepository = { source: 'LIVE', async *loadCreations(profile) { yield { assets: [asset('creation', profile)], resolved: 1, total: 1, failures: 1, complete: true }; } };
  const store = createCreationsStore({ liveRepository, fixtureRepository: emptyFixture });
  await store.getState().load(PROFILE_A);
  assert.deepEqual(store.getState().assets.map((entry) => entry.id), ['creation']);
  assert.strictEqual(useLibraryStore.getState().assets, libraryBefore);
});

test('cancels stale requests when the viewed profile changes', async () => {
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const liveRepository = { source: 'LIVE', async *loadCreations(profile, { signal }) {
    if (profile === PROFILE_A) await firstGate;
    if (signal.aborted) { const error = new Error('aborted'); error.name = 'AbortError'; throw error; }
    yield { assets: [asset(profile, profile)], resolved: 1, total: 1, failures: 1, complete: true };
  } };
  const store = createCreationsStore({ liveRepository, fixtureRepository: emptyFixture });
  const first = store.getState().load(PROFILE_A);
  const second = store.getState().load(PROFILE_B);
  await second;
  releaseFirst();
  await first;
  assert.equal(store.getState().profileAddress, PROFILE_B);
  assert.deepEqual(store.getState().assets.map((entry) => entry.id), [PROFILE_B]);
});

test('live failure is explicit when fixture fallback is shown', async () => {
  const liveRepository = { source: 'LIVE', async *loadCreations() { throw new Error('indexer offline'); } };
  const fixtureRepository = { source: 'FIXTURE', async *loadCreations(profile) { yield { assets: [asset('fixture', profile)], resolved: 1, total: 1, failures: 1, complete: true }; } };
  const store = createCreationsStore({ liveRepository, fixtureRepository });
  await store.getState().load(PROFILE_A);
  assert.equal(store.getState().sourceMode, 'FIXTURE');
  assert.equal(store.getState().liveError, 'indexer offline');
  assert.equal(store.getState().status, 'ready');
});

test('production store never invents creations when the live source fails', async () => {
  const liveRepository = { source: 'LIVE', async *loadCreations() { throw new Error('indexer offline'); } };
  const store = createCreationsStore({ liveRepository });
  await store.getState().load(PROFILE_A);
  assert.equal(store.getState().sourceMode, 'LIVE');
  assert.equal(store.getState().status, 'error');
  assert.equal(store.getState().error, 'indexer offline');
  assert.deepEqual(store.getState().assets, []);
});
