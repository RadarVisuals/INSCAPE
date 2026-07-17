import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureProfileIdentityRepository, FIXTURE_IDENTITY_ADDRESSES } from './fixtureProfileIdentityRepository.js';
import { lsp3ProfileIdentityRepository } from './lsp3ProfileIdentityRepository.js';
import { getProfileIdentityCache } from '../state/profileIdentityService.js';

test('fixture identities cover resolved, unavailable, malformed, failure, and hostile records', async () => {
  const radar = await fixtureProfileIdentityRepository.resolve(FIXTURE_IDENTITY_ADDRESSES.RADAR);
  assert.equal(radar.name, 'RADAR'); assert.equal(radar.avatarUrl, '/fixtures/profile-identity-radar.svg');
  assert.equal((await fixtureProfileIdentityRepository.resolve(FIXTURE_IDENTITY_ADDRESSES.NAME_ONLY)).avatarUrl, null);
  assert.equal((await fixtureProfileIdentityRepository.resolve(FIXTURE_IDENTITY_ADDRESSES.MISSING)).status, 'UNAVAILABLE');
  assert.equal((await fixtureProfileIdentityRepository.resolve(FIXTURE_IDENTITY_ADDRESSES.EOA)).errorCode, 'NOT_UNIVERSAL_PROFILE');
  assert.equal((await fixtureProfileIdentityRepository.resolve(FIXTURE_IDENTITY_ADDRESSES.MALFORMED)).errorCode, 'MALFORMED_METADATA');
  assert.equal((await fixtureProfileIdentityRepository.resolve(FIXTURE_IDENTITY_ADDRESSES.FAILURE)).status, 'ERROR');
  assert.equal((await fixtureProfileIdentityRepository.resolve(FIXTURE_IDENTITY_ADDRESSES.HOSTILE)).name.length, 80);
});

test('LIVE and FIXTURE identity caches remain isolated', () => {
  assert.notStrictEqual(getProfileIdentityCache('LIVE'), getProfileIdentityCache('FIXTURE'));
  assert.equal(getProfileIdentityCache('LIVE').repository, lsp3ProfileIdentityRepository);
  assert.equal(getProfileIdentityCache('FIXTURE').repository, fixtureProfileIdentityRepository);
});
