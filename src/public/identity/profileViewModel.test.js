import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getIdentityProfileViewModel,
  normalizePublicProfile
} from './profileViewModel.js';

test('Identity data crosses a normalized local view-model boundary', () => {
  const profile = getIdentityProfileViewModel();

  assert.equal(typeof profile.name, 'string');
  assert.equal(typeof profile.address, 'string');
  assert.ok(profile.tags.length >= 3);
  assert.deepEqual(profile.stats.map((stat) => stat.label), ['Followers', 'Following']);
  assert.equal(profile.wallet.connected, false);
  assert.equal(profile.followAction.disabled, true);
  assert.match(profile.followAction.explanation, /Local preview only/);
  assert.ok(Object.isFrozen(profile));
});

test('profile normalization bounds tags and does not imply live relationship state', () => {
  const profile = normalizePublicProfile({
    name: 'Test resident',
    tags: ['one', '', 'two', 3, 'three', 'four', 'five', 'six', 'seven'],
    social: { followers: -20, following: 12 },
    wallet: { connected: true }
  });

  assert.deepEqual(profile.tags, ['one', 'two', 'three', 'four', 'five', 'six']);
  assert.equal(profile.stats[0].value, '0');
  assert.equal(profile.wallet.label, 'Wallet present');
  assert.equal(profile.followAction.disabled, true);
});
