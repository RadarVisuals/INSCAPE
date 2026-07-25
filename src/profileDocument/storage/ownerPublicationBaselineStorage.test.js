import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOwnerPublicationBaseline, ownerPublicationBaselineKey, publicationPointerMetadata, saveOwnerPublicationBaseline } from './ownerPublicationBaselineStorage.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('publication baselines are isolated by normalized profile address', () => {
  const target = storage();
  assert.equal(saveOwnerPublicationBaseline(target, PROFILE, { cid: 'bafy-one', pointerHash: `0x${'a'.repeat(64)}`,
    publishedFingerprint: 'published', localFingerprint: 'local', hydratedAt: 12 }), true);
  assert.equal(loadOwnerPublicationBaseline(target, `0x${PROFILE.slice(2).toUpperCase()}`)?.cid, 'bafy-one');
  assert.match(ownerPublicationBaselineKey(PROFILE), new RegExp(`${PROFILE}$`));
});

test('pointer metadata retains only the CID and verification hash', () => {
  assert.deepEqual(publicationPointerMetadata({ url: 'ipfs://bafy-two', verification: { data: `0x${'B'.repeat(64)}` } }),
    { cid: 'bafy-two', pointerHash: `0x${'b'.repeat(64)}` });
});
