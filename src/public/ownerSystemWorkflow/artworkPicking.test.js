import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkMaskCache } from './artworkPicking.js';
const mask = bytes => ({ status: 'ready', alpha: new Uint8Array(bytes) });

test('many small decoded masks fit while the original 24 MiB byte ceiling remains bounded', () => {
  const small = createArtworkMaskCache();
  for (let i = 0; i < 40; i++) small.remember(`small:${i}`, mask(128 * 128));
  assert.ok(Array.from({ length: 40 }, (_, i) => small.read(`small:${i}`)).every(Boolean));
  const large = createArtworkMaskCache();
  for (let i = 0; i < 32; i++) large.remember(`large:${i}`, mask(1024 * 1024));
  assert.equal(Array.from({ length: 32 }, (_, i) => large.read(`large:${i}`)).filter(Boolean).length, 24);
});

test('mask LRU, replacement and expiry release their exact buffer accounting', () => {
  let now = 0;
  const cache = createArtworkMaskCache({ maxBytes: 8, maxEntries: 4, ttl: 10, now: () => now });
  cache.remember('a', mask(4)); cache.remember('b', mask(4)); cache.read('a');
  cache.remember('c', mask(4));
  assert.equal(cache.read('b'), null); assert.ok(cache.read('a')); assert.ok(cache.read('c'));
  cache.remember('a', mask(2)); now = 5; cache.remember('c', mask(4)); cache.remember('d', mask(2));
  assert.ok(cache.read('c')); assert.ok(cache.read('a')); assert.ok(cache.read('d'));
  now = 11; assert.equal(cache.read('a'), null);
  cache.remember('e', mask(2)); assert.ok(cache.read('c')); assert.ok(cache.read('d')); assert.ok(cache.read('e'));
});

test('unavailable metadata has a separate entry bound and oversized buffers are not retained', () => {
  const cache = createArtworkMaskCache({ maxBytes: 8, maxEntries: 3 });
  for (let i = 0; i < 4; i++) cache.remember(String(i), { status: 'unavailable' });
  assert.equal(cache.read('0'), null); assert.ok(cache.read('3'));
  cache.remember('large', mask(9)); assert.equal(cache.read('large'), null);
  cache.remember('3', mask(8)); cache.remember('3', { status: 'unavailable' });
  cache.remember('fit', mask(8)); assert.ok(cache.read('fit')); assert.ok(cache.read('3'));
});
