import test from 'node:test';
import assert from 'node:assert/strict';
import { createViewedProfileUrl, resolveViewedProfile } from './viewedProfileUrl.js';

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
