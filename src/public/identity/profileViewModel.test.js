import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getIdentityProfileViewModel,
  normalizePublicProfile
} from './profileViewModel.js';

test('Identity prototype data crosses a centralized normalized view-model boundary', () => {
  const profile = getIdentityProfileViewModel();

  assert.equal(profile.artistName, 'VXCTXR');
  assert.equal(profile.collectionName, 'Human Underneath');
  assert.deepEqual(profile.tags, ['Digital Art', 'Creature Design', 'Animation']);
  assert.equal(profile.followers, 1204);
  assert.equal(profile.connected, true);
  assert.ok(Object.isFrozen(profile));
});

test('profile normalization bounds tags, follower counts, and connection state', () => {
  const profile = normalizePublicProfile({
    artistName: 'Test artist',
    collectionName: 'Test collection',
    tags: ['one', '', 'two', 3, 'three', 'four', 'five', 'six', 'seven'],
    followers: -20,
    connected: 'yes'
  });

  assert.deepEqual(profile.tags, ['one', 'two', 'three', 'four', 'five', 'six']);
  assert.equal(profile.followers, 0);
  assert.equal(profile.connected, false);
});
