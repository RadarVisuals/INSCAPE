import { createErrorIdentity, createUnavailableIdentity, normalizeLsp3Identity } from '../domain/profileIdentity.js';

export const FIXTURE_IDENTITY_ADDRESSES = Object.freeze({
  RADAR: '0x1234567890abcdef1234567890abcdef123489ef',
  NAME_ONLY: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  MISSING: '0x3333333333333333333333333333333333333333',
  EOA: '0x4444444444444444444444444444444444444444',
  MALFORMED: '0x5555555555555555555555555555555555555555',
  FAILURE: '0x6666666666666666666666666666666666666666',
  HOSTILE: '0x7777777777777777777777777777777777777777'
});

export const fixtureProfileIdentityRepository = {
  source: 'FIXTURE',
  async resolve(address) {
    const key = String(address).toLowerCase();
    if (key === FIXTURE_IDENTITY_ADDRESSES.RADAR) return normalizeLsp3Identity(key, {
      name: 'RADAR', profileImage: [{ url: '/fixtures/profile-identity-radar.svg', width: 96 }]
    }, { source: 'FIXTURE', allowRelative: true });
    if (key === FIXTURE_IDENTITY_ADDRESSES.NAME_ONLY) return normalizeLsp3Identity(key, { name: 'NOCTURNE' }, { source: 'FIXTURE' });
    if (key === FIXTURE_IDENTITY_ADDRESSES.HOSTILE) return normalizeLsp3Identity(key, {
      name: '<script>alert(1)</script> A profile name designed to be excessively long '.repeat(3)
    }, { source: 'FIXTURE' });
    if (key === FIXTURE_IDENTITY_ADDRESSES.MISSING) return createUnavailableIdentity(key, { source: 'FIXTURE', isUniversalProfile: true });
    if (key === FIXTURE_IDENTITY_ADDRESSES.EOA) return createUnavailableIdentity(key, { source: 'FIXTURE', errorCode: 'NOT_UNIVERSAL_PROFILE' });
    if (key === FIXTURE_IDENTITY_ADDRESSES.MALFORMED) return createUnavailableIdentity(key, { source: 'FIXTURE', isUniversalProfile: true, errorCode: 'MALFORMED_METADATA' });
    if (key === FIXTURE_IDENTITY_ADDRESSES.FAILURE) return createErrorIdentity(key, { source: 'FIXTURE' });
    return createUnavailableIdentity(key, { source: 'FIXTURE', errorCode: 'NOT_UNIVERSAL_PROFILE' });
  }
};
