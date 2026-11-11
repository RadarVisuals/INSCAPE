import assert from 'node:assert/strict';
import test from 'node:test';
import { libraryAssetCacheKey, loadLibraryAssetCache, saveLibraryAssetCache } from './libraryAssetCache.js';

const profile = '0xf3c189819fd5b042f692983bfbfd57ab607ee709';
const contractAddress = '0x1111111111111111111111111111111111111111';
const tokenId = `0x${'0'.repeat(63)}1`;
const asset = { id: `42:${contractAddress}:${tokenId}`, chainId: 42, ownerAddress: profile,
  contractAddress, tokenId, imageUrl: 'https://gateway.example/image', name: 'Cached work',
  fieldProvenance: { name: { scope: 'tokenId', source: 'LSP4MetadataForTokenId' } } };

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('asset cache restores validated profile-scoped assets', () => {
  const storage = memoryStorage();
  assert.equal(saveLibraryAssetCache(storage, profile, [asset], 100), true);
  assert.deepEqual(loadLibraryAssetCache(storage, profile, 200), [asset]);
});

test('asset cache rejects expired, cross-profile and malformed records', () => {
  const storage = memoryStorage();
  saveLibraryAssetCache(storage, profile, [asset], 100);
  assert.deepEqual(loadLibraryAssetCache(storage, profile, 8 * 24 * 60 * 60 * 1000), []);
  const payload = JSON.parse(storage.getItem(libraryAssetCacheKey(profile)));
  payload.updatedAt = Date.now();
  payload.assets = [{ ...asset, ownerAddress: '0x2222222222222222222222222222222222222222' },
    { ...asset, imageUrl: 'javascript:bad' }];
  storage.setItem(libraryAssetCacheKey(profile), JSON.stringify(payload));
  assert.deepEqual(loadLibraryAssetCache(storage, profile), []);
});

test('pre-provenance v1 records are ignored so focus metadata is resolved live', () => {
  const storage = memoryStorage();
  storage.setItem(`inscape.library-assets.v1:${profile}`, JSON.stringify({ version: 1, profileAddress: profile,
    updatedAt: Date.now(), assets: [{ ...asset, fieldProvenance: undefined }] }));
  assert.match(libraryAssetCacheKey(profile), /^inscape\.library-assets\.v2:/u);
  assert.deepEqual(loadLibraryAssetCache(storage, profile), []);
});
