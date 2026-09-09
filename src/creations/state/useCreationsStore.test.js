import test from 'node:test';
import assert from 'node:assert/strict';
import { useLibraryStore } from '../../library/state/useLibraryStore.js';
import { createCreationsStore } from './useCreationsStore.js';

const PROFILE_A = '0x1234567890abcdef1234567890abcdef12345678';
const PROFILE_B = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const COLLECTION_A = '0x1111111111111111111111111111111111111111';
const COLLECTION_B = '0x2222222222222222222222222222222222222222';

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

test('retry retains accepted progressive results when refresh fails', async () => {
  let attempt = 0;
  const liveRepository = { source: 'LIVE', async *loadCreations(profile) {
    attempt += 1;
    if (attempt === 1) yield { assets: [asset('retained', profile)], resolved: 1, total: 2, failures: 0, complete: false };
    else throw new Error('refresh offline');
  } };
  const store = createCreationsStore({ liveRepository, retainOnRetry: true });
  await store.getState().load(PROFILE_A);
  await store.getState().retry();
  assert.equal(store.getState().status, 'partial');
  assert.equal(store.getState().liveError, 'refresh offline');
  assert.deepEqual(store.getState().assets.map(({ id: assetId }) => assetId), ['retained']);
});

test('explicit cancellation retains accepted results and leaves no loading state', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const liveRepository = { source: 'LIVE', async *loadCreations(profile, { signal }) {
    yield { assets: [asset('progressive', profile)], resolved: 1, total: 2, failures: 0, complete: false };
    await gate;
    if (signal.aborted) { const error = new Error('aborted'); error.name = 'AbortError'; throw error; }
  } };
  const store = createCreationsStore({ liveRepository });
  const loading = store.getState().load(PROFILE_A);
  await new Promise((resolve) => setImmediate(resolve));
  store.getState().cancel(); release(); await loading;
  assert.equal(store.getState().status, 'ready');
  assert.deepEqual(store.getState().assets.map(({ id: assetId }) => assetId), ['progressive']);
});

test('resolves only placed LSP8 collection tokens without opening Library or adding them to its top level', async () => {
  const collection = (contractAddress) => ({
    id: `42:${contractAddress}:contract`, contractAddress, isCollection: true,
    creators: [{ address: PROFILE_A }], viewedProfileIsCreator: true, creatorAttributionLevel: 'contract',
  });
  const requested = `42:${COLLECTION_A}:0x01`;
  const unrelated = `42:${COLLECTION_A}:0x02`;
  const calls = [];
  const liveRepository = {
    source: 'LIVE',
    async *loadCreations() {
      yield { assets: [collection(COLLECTION_A), collection(COLLECTION_B)], resolved: 2, total: 2, failures: 0, complete: true };
    },
    async *loadCollectionTokens(profile, record) {
      calls.push({ profile, contractAddress: record.contractAddress });
      yield { assets: [{ id: requested }, { id: unrelated }], resolved: 2, total: 2, failures: 0, complete: true };
    },
  };
  const store = createCreationsStore({ liveRepository });
  await store.getState().load(PROFILE_A);
  await store.getState().resolveReferencedAssets(PROFILE_A, [requested]);
  assert.deepEqual(calls, [{ profile: PROFILE_A, contractAddress: COLLECTION_A }]);
  assert.deepEqual(store.getState().referencedAssets.map(({ id }) => id), [requested]);
  assert.deepEqual(store.getState().assets.map(({ id }) => id), [
    `42:${COLLECTION_A}:contract`, `42:${COLLECTION_B}:contract`,
  ]);
});

test('targeted curated resolution does not require or start the full creations inventory', async () => {
  const requestedContract = `42:${COLLECTION_B}:contract`;
  const requested = `42:${COLLECTION_A}:0x01`;
  let fullLoads = 0;
  const calls = [];
  const store = createCreationsStore({ liveRepository: {
    source: 'LIVE',
    async *loadCreations() { fullLoads += 1; yield { assets: [], resolved: 0, total: 0, failures: 0, complete: true }; },
    async *loadReferencedCreations(profile, ids) {
      calls.push({ profile, ids });
      yield { assets: [{ id: requested }, { id: requestedContract }], resolved: 2, total: 2, failures: 0, complete: true };
    },
  } });
  assert.equal(store.getState().setProfileAddress(PROFILE_A), true);
  await store.getState().resolveReferencedAssets(PROFILE_A, [requested, requestedContract]);

  assert.equal(fullLoads, 0);
  assert.deepEqual(calls, [{ profile: PROFILE_A, ids: [requested, requestedContract] }]);
  assert.deepEqual(store.getState().referencedAssets.map(({ id }) => id), [requested, requestedContract]);
  assert.equal(store.getState().status, 'idle');
});

test('referenced LSP8 resolution is profile-scoped, deduplicated, and stale-safe', async () => {
  const requested = `42:${COLLECTION_A}:0x01`;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let calls = 0;
  const liveRepository = {
    source: 'LIVE',
    async *loadCreations(profile) {
      yield { assets: [{ id: `42:${COLLECTION_A}:contract`, contractAddress: COLLECTION_A, isCollection: true,
        creators: [{ address: profile }], viewedProfileIsCreator: true, creatorAttributionLevel: 'contract' }],
      resolved: 1, total: 1, failures: 0, complete: true };
    },
    async *loadCollectionTokens() {
      calls += 1;
      await gate;
      yield { assets: [{ id: requested }], resolved: 1, total: 1, failures: 0, complete: true };
    },
  };
  const store = createCreationsStore({ liveRepository });
  await store.getState().load(PROFILE_A);
  const first = store.getState().resolveReferencedAssets(PROFILE_A, [requested, requested]);
  await store.getState().resolveReferencedAssets(PROFILE_A, [requested]);
  await store.getState().load(PROFILE_B);
  release();
  await first;
  assert.equal(calls, 1);
  assert.equal(store.getState().profileAddress, PROFILE_B);
  assert.deepEqual(store.getState().referencedAssets, []);
});
