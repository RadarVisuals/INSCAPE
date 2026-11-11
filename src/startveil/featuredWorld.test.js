import assert from 'node:assert/strict';
import test from 'node:test';
import { FEATURED_WORLD_PROFILE_ADDRESS, selectFeaturedWorld } from './featuredWorld.js';

test('the featured world stays fixed when directory order changes', () => {
  const other = { address: '0x1111111111111111111111111111111111111111', name: 'Other world' };
  const featured = { address: FEATURED_WORLD_PROFILE_ADDRESS.toUpperCase(), name: 'Featured artist' };
  assert.equal(selectFeaturedWorld([other, featured]), featured);
  assert.equal(selectFeaturedWorld([featured, other]), featured);
});

test('an unavailable directory retains the featured address without inventing identity or publication facts', () => {
  assert.deepEqual(selectFeaturedWorld([]), {
    address: FEATURED_WORLD_PROFILE_ADDRESS, name: null, avatarUrl: null,
  });
});
