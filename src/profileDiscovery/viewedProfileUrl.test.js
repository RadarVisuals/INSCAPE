import test from 'node:test';
import assert from 'node:assert/strict';
import { createViewedProfileUrl, resolveExplicitViewedProfile, resolveViewedProfile } from './viewedProfileUrl.js';

const CONNECTED = '0x1111111111111111111111111111111111111111';
const VIEWED = '0x2222222222222222222222222222222222222222';

test('viewed profile URL state is distinct from the workspace profile parameter', () => {
  const location = { href: `https://example.test/?profile=${CONNECTED}&mode=public`, search: `?profile=${CONNECTED}&mode=public` };
  const url = createViewedProfileUrl(location, VIEWED, CONNECTED);
  assert.match(url, new RegExp(`profile=${CONNECTED}`));
  assert.match(url, new RegExp(`view=${VIEWED}`));
  assert.equal(resolveViewedProfile({ search: `?profile=${CONNECTED}&view=${VIEWED}` }, CONNECTED), VIEWED);
});

test('returning to the connected profile removes only the view parameter', () => {
  const location = { href: `https://example.test/?profile=${CONNECTED}&view=${VIEWED}`, search: `?profile=${CONNECTED}&view=${VIEWED}` };
  const url = createViewedProfileUrl(location, CONNECTED, CONNECTED);
  assert.match(url, new RegExp(`profile=${CONNECTED}`));
  assert.doesNotMatch(url, /[?&]view=/);
});

test('an explicit navigation target is not replaced by a later wallet identity', () => {
  const location = { search: `?profile=${CONNECTED}&view=${VIEWED}` };
  assert.equal(resolveViewedProfile(location, '0x3333333333333333333333333333333333333333'), VIEWED);
});

test('explicit URL intent excludes profile and connected fallbacks', () => {
  assert.equal(resolveExplicitViewedProfile({ search: `?profile=${CONNECTED}` }), null);
  assert.equal(resolveExplicitViewedProfile({ search: `?view=${VIEWED}` }), VIEWED);
  assert.equal(resolveExplicitViewedProfile({ search: '?view=invalid' }), null);
});
