import assert from 'node:assert/strict';
import test from 'node:test';
import { getOfficialProfileUrl, normalizeLsp3Identity, PROFILE_IDENTITY_STATUS, selectProfileAvatar } from './profileIdentity.js';

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

test('normalizes canonical addresses and public LSP3 text', () => {
  const identity = normalizeLsp3Identity(ADDRESS.toUpperCase().replace('0X', '0x'), { name: '  RADAR\u0000  SIGNAL  ', description: ' public ' });
  assert.equal(identity.normalizedAddress, ADDRESS);
  assert.equal(identity.name, 'RADAR SIGNAL');
  assert.equal(identity.description, 'public');
  assert.equal(identity.status, PROFILE_IDENTITY_STATUS.RESOLVED);
});

test('bounds hostile names and never interprets their markup', () => {
  const identity = normalizeLsp3Identity(ADDRESS, { name: '<script>alert(1)</script>'.repeat(20) });
  assert.equal(identity.name.length, 80);
  assert.match(identity.name, /^<script>/);
});

test('selects the smallest suitable safe avatar and resolves IPFS', () => {
  const avatar = selectProfileAvatar([{ url: 'ipfs://large', width: 1200 }, { url: 'ipfs://small', width: 96 }, { url: 'javascript:bad', width: 64 }], { ipfsGateway: 'https://gw.test/ipfs/' });
  assert.equal(avatar, 'https://gw.test/ipfs/small');
});

test('constructs official links from addresses only', () => {
  assert.equal(getOfficialProfileUrl(ADDRESS), `https://universaleverything.io/${ADDRESS}`);
  assert.equal(getOfficialProfileUrl('invalid'), null);
  assert.equal(normalizeLsp3Identity('invalid', { name: 'No' }), null);
});
