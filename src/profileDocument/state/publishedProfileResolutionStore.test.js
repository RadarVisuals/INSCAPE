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

test('switching addresses aborts the former request and ignores a late stale generation', async () => {
  let finishA; let signalA;
  const repository = { resolve(address, { signal }) {
    if (address === PROFILE_A) { signalA = signal; return new Promise((resolve) => { finishA = resolve; }); }
    return Promise.resolve({ status: PUBLISHED_PROFILE_STATUS.UNAVAILABLE, address, document: null });
  } };
  const store = new PublishedProfileResolutionStore({ repository });
  const first = store.resolve(PROFILE_A); const second = await store.resolve(PROFILE_B);
  assert.equal(signalA.aborted, true); assert.equal(second.status, PUBLISHED_PROFILE_STATUS.UNAVAILABLE);
  finishA({ status: PUBLISHED_PROFILE_STATUS.RESOLVED, address: PROFILE_A, document: documentA });
  await first;
  assert.equal(store.get(PROFILE_A).status, PUBLISHED_PROFILE_STATUS.LOADING);
  assert.equal(store.get(PROFILE_B).status, PUBLISHED_PROFILE_STATUS.UNAVAILABLE);
});
