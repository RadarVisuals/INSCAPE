import assert from 'node:assert/strict';
import test from 'node:test';
import { PUBLISHED_PROFILE_STATUS } from '../storage/luksoPublishedProfileRepository.js';
import { PublishedProfileResolutionStore } from './publishedProfileResolutionStore.js';

const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';
const documentA = Object.freeze({ profile: { address: PROFILE_A } });

test('initial transient failure is ERROR while a same-session refresh failure retains only the valid document as STALE', async () => {
  let call = 0;
  const repository = { async resolve() { call += 1; if (call === 1) throw new Error('offline'); if (call === 2) return { status: PUBLISHED_PROFILE_STATUS.RESOLVED, address: PROFILE_A, document: documentA }; throw new Error('offline again'); } };
  const store = new PublishedProfileResolutionStore({ repository });
  assert.equal((await store.resolve(PROFILE_A)).status, PUBLISHED_PROFILE_STATUS.ERROR);
  assert.equal((await store.resolve(PROFILE_A)).status, PUBLISHED_PROFILE_STATUS.RESOLVED);
  const stale = await store.resolve(PROFILE_A);
  assert.equal(stale.status, PUBLISHED_PROFILE_STATUS.STALE); assert.strictEqual(stale.document, documentA);
});

test('different profile addresses resolve concurrently without cancelling neighbouring world cards', async () => {
  let finishA; let signalA;
  const repository = { resolve(address, { signal }) {
    if (address === PROFILE_A) { signalA = signal; return new Promise((resolve) => { finishA = resolve; }); }
    return Promise.resolve({ status: PUBLISHED_PROFILE_STATUS.UNAVAILABLE, address, document: null });
  } };
  const store = new PublishedProfileResolutionStore({ repository });
  const first = store.resolve(PROFILE_A); const second = await store.resolve(PROFILE_B);
  assert.equal(signalA.aborted, false); assert.equal(second.status, PUBLISHED_PROFILE_STATUS.UNAVAILABLE);
  finishA({ status: PUBLISHED_PROFILE_STATUS.RESOLVED, address: PROFILE_A, document: documentA });
  await first;
  assert.equal(store.get(PROFILE_A).status, PUBLISHED_PROFILE_STATUS.RESOLVED);
  assert.equal(store.get(PROFILE_B).status, PUBLISHED_PROFILE_STATUS.UNAVAILABLE);
});

test('same-address rapid retry is deduplicated and preserves verified content as busy STALE', async () => {
  let calls = 0; let finishRetry;
  const repository = { resolve() { calls += 1; if (calls === 1) return Promise.resolve({ status: PUBLISHED_PROFILE_STATUS.RESOLVED, address: PROFILE_A, document: documentA });
    return new Promise((resolve) => { finishRetry = resolve; }); } };
  const store = new PublishedProfileResolutionStore({ repository }); await store.resolve(PROFILE_A);
  const first = store.resolve(PROFILE_A); const second = store.resolve(PROFILE_A);
  assert.strictEqual(first, second); assert.equal(calls, 2);
  assert.equal(store.get(PROFILE_A).status, PUBLISHED_PROFILE_STATUS.STALE); assert.equal(store.get(PROFILE_A).busy, true);
  assert.strictEqual(store.get(PROFILE_A).document, documentA);
  finishRetry({ status: PUBLISHED_PROFILE_STATUS.RESOLVED, address: PROFILE_A, document: documentA });
  assert.equal((await first).status, PUBLISHED_PROFILE_STATUS.RESOLVED); assert.equal(store.get(PROFILE_A).busy, false);
});

test('retry after ERROR resolves and a definitive recheck discards stale content', async () => {
  let call = 0;
  const repository = { async resolve() { call += 1; if (call === 1) throw Object.assign(new Error('timeout'), { code: 'RPC_TIMEOUT' });
    if (call === 2) return { status: PUBLISHED_PROFILE_STATUS.RESOLVED, address: PROFILE_A, document: documentA };
    return { status: PUBLISHED_PROFILE_STATUS.INVALID, address: PROFILE_A, document: null, errorCode: 'HASH_MISMATCH' }; } };
  const store = new PublishedProfileResolutionStore({ repository });
  const failed = await store.resolve(PROFILE_A); assert.equal(failed.status, PUBLISHED_PROFILE_STATUS.ERROR); assert.equal(failed.errorCode, 'RPC_TIMEOUT');
  assert.equal((await store.resolve(PROFILE_A)).status, PUBLISHED_PROFILE_STATUS.RESOLVED);
  const invalid = await store.resolve(PROFILE_A); assert.equal(invalid.status, PUBLISHED_PROFILE_STATUS.INVALID); assert.equal(invalid.document, null);
});

test('an address change during retry cannot restore the prior address document', async () => {
  let call = 0; let finishOldRetry;
  const repository = { resolve(address) { call += 1;
    if (call === 1) return Promise.resolve({ status: PUBLISHED_PROFILE_STATUS.RESOLVED, address: PROFILE_A, document: documentA });
    if (address === PROFILE_A) return new Promise((resolve) => { finishOldRetry = resolve; });
    return Promise.resolve({ status: PUBLISHED_PROFILE_STATUS.UNAVAILABLE, address, document: null });
  } };
  const store = new PublishedProfileResolutionStore({ repository }); await store.resolve(PROFILE_A);
  const oldRetry = store.resolve(PROFILE_A); const current = await store.resolve(PROFILE_B);
  assert.equal(current.status, PUBLISHED_PROFILE_STATUS.UNAVAILABLE); assert.equal(store.get(PROFILE_B).document, null);
  finishOldRetry({ status: PUBLISHED_PROFILE_STATUS.RESOLVED, address: PROFILE_A, document: documentA }); await oldRetry;
  assert.equal(store.get(PROFILE_B).status, PUBLISHED_PROFILE_STATUS.UNAVAILABLE); assert.equal(store.get(PROFILE_B).document, null);
});
