import test from 'node:test';
import assert from 'node:assert/strict';
import { identityCode, PROFILE_IDENTITY_CARD_STATE as S, selectProfileCardLinks, transitionProfileIdentityCard } from './profileIdentityCardModel.js';

test('avatar itself cycles through avatar, compact, expanded, avatar', () => {
  assert.equal(transitionProfileIdentityCard(S.AVATAR, 'avatar'), S.COMPACT);
  assert.equal(transitionProfileIdentityCard(S.COMPACT, 'avatar'), S.EXPANDED);
  assert.equal(transitionProfileIdentityCard(S.EXPANDED, 'avatar'), S.AVATAR);
  assert.equal(transitionProfileIdentityCard(S.COMPACT, 'toggle'), S.EXPANDED);
  assert.equal(transitionProfileIdentityCard(S.EXPANDED, 'toggle'), S.AVATAR);
  assert.equal(transitionProfileIdentityCard(S.EXPANDED, 'escape'), S.AVATAR);
});

test('identity code uses the first four address characters after 0x', () => {
  assert.equal(identityCode('0xe3c1abcdef'), '#E3C1');
  assert.equal(identityCode(null), '#----');
});

test('card prefers three real metadata links over the synthetic official profile fallback', () => {
  const links = [
    { id: 'official-profile', label: 'Universal Profile', url: 'https://universaleverything.io/profile/0x1' },
    { id: 'x-one', label: 'X', url: 'https://x.com/one' },
    { id: 'x-two', label: 'X', url: 'https://x.com/two' },
    { id: 'radar', label: 'Radar // UP', url: 'https://example.com/radar' }
  ];
  assert.deepEqual(selectProfileCardLinks(links).map((link) => link.id), ['x-one', 'x-two', 'radar']);
  assert.deepEqual(selectProfileCardLinks(links.slice(0, 1)).map((link) => link.id), ['official-profile']);
});
