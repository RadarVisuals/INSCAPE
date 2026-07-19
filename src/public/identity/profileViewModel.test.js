import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOLLOWERS_DISCLOSURE,
  getIdentityProfileViewModel
} from './profileViewModel.js';
import { createUnavailableIdentity, normalizeLsp3Identity } from '../../profileIdentity/domain/profileIdentity.js';

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

test('profile card view model exposes only resolved live metadata', () => {
  const identity = normalizeLsp3Identity(ADDRESS, {
    name: 'RADAR', description: 'A live bio', tags: ['art'],
    links: [{ title: 'Site', url: 'https://example.com' }]
  });
  const profile = getIdentityProfileViewModel(identity, { walletConnected: true });

  assert.equal(profile.name, 'RADAR');
  assert.equal(profile.bio, 'A live bio');
  assert.deepEqual(profile.tags, ['art']);
  assert.equal(profile.links[0].url, `https://universaleverything.io/${ADDRESS}`);
  assert.equal(profile.links[1].url, 'https://example.com/');
  assert.equal(profile.metadataResolved, true);
  assert.equal(profile.walletConnected, true);
  assert.equal('followers' in profile, false);
  assert.equal('collectionName' in profile, false);
  assert.equal('badges' in profile, false);
  assert.ok(Object.isFrozen(profile));
});

test('metadata resolution and visitor wallet connection remain independent', () => {
  const resolved = getIdentityProfileViewModel(normalizeLsp3Identity(ADDRESS, { name: 'Live' }));
  const unavailable = getIdentityProfileViewModel(createUnavailableIdentity(ADDRESS), { walletConnected: true });

  assert.equal(resolved.metadataResolved, true);
  assert.equal(resolved.walletConnected, false);
  assert.equal(unavailable.metadataResolved, false);
  assert.equal(unavailable.walletConnected, true);
  assert.equal(unavailable.name, 'Unnamed profile');
  assert.equal(unavailable.bio, null);
  assert.deepEqual(unavailable.tags, []);
  assert.match(FOLLOWERS_DISCLOSURE, /social graph or indexer/);
});
