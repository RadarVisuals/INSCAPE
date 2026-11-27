import assert from 'node:assert/strict';
import test from 'node:test';
import { createCollectionTokensStore } from './useCollectionTokensStore.js';

const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';
const COLLECTION_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const COLLECTION_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const collection = (contractAddress) => ({ contractAddress, isCollection: true });
const token = (id) => ({ id, viewedProfileIsCollectionCreator: true });

test('loads progressive collection pages and replaces tokens when collection scope changes', async () => {
  const repository = { async *loadCollectionTokens(_profile, record) {
    yield { assets: [token(`${record.contractAddress}:1`)], resolved: 1, total: 2, failures: 0, complete: false };
    yield { assets: [token(`${record.contractAddress}:2`)], resolved: 2, total: 2, failures: 0, complete: true };
  } };
  const store = createCollectionTokensStore({ repository });
  await store.getState().load(PROFILE_A, collection(COLLECTION_A));
  assert.equal(store.getState().status, 'ready');
  assert.equal(store.getState().assets.length, 1);
  assert.equal(store.getState().hasMore, true);
  await store.getState().loadMore();
  assert.equal(store.getState().hasMore, false);
  assert.deepEqual(store.getState().assets.map(({ id }) => id), [`${COLLECTION_A}:1`, `${COLLECTION_A}:2`]);
  await store.getState().load(PROFILE_A, collection(COLLECTION_B));
  await store.getState().loadMore();
  assert.deepEqual(store.getState().assets.map(({ id }) => id), [`${COLLECTION_B}:1`, `${COLLECTION_B}:2`]);
});

test('profile changes abort stale collection results and never leak profile A tokens into profile B', async () => {
  let releaseFirst;
  const gate = new Promise((resolve) => { releaseFirst = resolve; });
  const repository = { async *loadCollectionTokens(profile, _record, { signal }) {
    if (profile === PROFILE_A) await gate;
    if (signal.aborted) { const error = new Error('aborted'); error.name = 'AbortError'; throw error; }
    yield { assets: [token(profile)], resolved: 1, total: 1, failures: 0, complete: true };
  } };
  const store = createCollectionTokensStore({ repository });
  const first = store.getState().load(PROFILE_A, collection(COLLECTION_A));
  await store.getState().load(PROFILE_B, collection(COLLECTION_A));
  releaseFirst();
  await first;
  assert.equal(store.getState().profileAddress, PROFILE_B);
  assert.deepEqual(store.getState().assets.map(({ id }) => id), [PROFILE_B]);
});

test('collection failure is explicit and retry starts from an empty bounded result', async () => {
  let attempt = 0;
  const repository = { async *loadCollectionTokens() {
    attempt += 1;
    if (attempt === 1) throw new Error('indexer offline');
    yield { assets: [token('recovered')], resolved: 1, total: 1, failures: 0, complete: true };
  } };
  const record = collection(COLLECTION_A);
  const store = createCollectionTokensStore({ repository });
  await store.getState().load(PROFILE_A, record);
  assert.equal(store.getState().status, 'error');
  assert.equal(store.getState().error, 'indexer offline');
  await store.getState().retry(record);
  assert.equal(store.getState().status, 'ready');
  assert.deepEqual(store.getState().assets.map(({ id }) => id), ['recovered']);
});


test('reopening a collection replaces the previous media snapshot and removed tokens', async () => {
  let attempt = 0;
  const repository = { async *loadCollectionTokens() {
    attempt++;
    const asset = { ...token('same-token'), imageGroups: [{ index: 0, imageUrl: 'https://art.test/' + attempt + '.webp' }] };
    yield { assets: attempt === 1 ? [asset, token('removed')] : [asset], resolved: 1, total: 1, failures: 0, complete: true };
  } };
  const store = createCollectionTokensStore({ repository });
  await store.getState().load(PROFILE_A, collection(COLLECTION_A));
  await store.getState().load(PROFILE_A, collection(COLLECTION_A));
  assert.deepEqual(store.getState().assets.map(a => a.id), ['same-token']);
  assert.deepEqual(store.getState().assets[0].imageGroups, [{ index: 0, imageUrl: 'https://art.test/2.webp' }]);
});

test('explicit metadata replaces media while preserving current ownership and creator scope', async () => {
  const before = { ...token('one'), ownerAddress: PROFILE_A, imageUrl: 'https://art.test/old.webp',
    imageGroups: [{ index: 0 }, { index: 1 }], fieldProvenance: { creators: { source: 'LSP4' } } };
  const store = createCollectionTokensStore({ repository: { async *loadCollectionTokens() {
    yield { assets: [before], resolved: 1, total: 1, failures: 0, complete: true };
  } } });
  await store.getState().load(PROFILE_A, collection(COLLECTION_A));
  store.getState().updateMetadata([{ id: 'one', ownerAddress: PROFILE_B, viewedProfileIsCollectionCreator: false,
    imageUrl: 'https://art.test/new.webp', imageGroups: [{ index: 0 }],
    fieldProvenance: { images: { scope: 'tokenId', source: 'RPC' } } }]);
  const asset = store.getState().assets[0];
  assert.equal(asset.imageUrl, 'https://art.test/new.webp');
  assert.equal(asset.imageGroups.length, 1);
  assert.equal(asset.ownerAddress, PROFILE_A);
  assert.equal(asset.viewedProfileIsCollectionCreator, true);
  assert.deepEqual(asset.fieldProvenance, { creators: { source: 'LSP4' }, images: { scope: 'tokenId', source: 'RPC' } });
});

test('closing during the next page settles the caller and ignores an abort-ignoring provider', { timeout: 2000 }, async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const store = createCollectionTokensStore({ repository: { async *loadCollectionTokens() {
    yield { assets: [token('first')], resolved: 1, total: 2, failures: 0, complete: false };
    await gate;
    yield { assets: [token('late')], resolved: 2, total: 2, failures: 0, complete: true };
  } } });
  await store.getState().load(PROFILE_A, collection(COLLECTION_A));
  const pending = store.getState().loadMore();
  store.getState().cancel();
  await pending;
  release(); await new Promise(setImmediate);
  assert.deepEqual(store.getState().assets.map(asset => asset.id), ['first']);
  assert.equal(store.getState().status, 'ready');
});
