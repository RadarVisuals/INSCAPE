import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sessionSource = readFileSync(new URL('./standaloneWalletSession.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');

test('standalone sign-in reports an explicit modal close signal', () => {
  assert.match(sessionSource, /onClose: \(\) => onSignInClose\?\.\(\)/);
  assert.doesNotMatch(sessionSource, /onConnect: .*onSignInClose/);
});

test('the sign-in modal gates provisional public status surfaces during Startveil handoff', () => {
  const activateIndex = appSource.indexOf('setStandaloneSignInActive(true)');
  const showIndex = appSource.indexOf('return session.showSignIn()');
  assert.ok(activateIndex >= 0 && activateIndex < showIndex);
  assert.match(appSource, /standaloneSignInActive \|\| publicEntryPortal \? null : profileTarget\.pending/);
  assert.match(appSource, /onSignInClose: \(\) => setStandaloneSignInActive\(false\)/);
  assert.match(appSource, /visitorWalletConnected && authorityLifecycleStatus === 'complete'/);
  assert.doesNotMatch(appSource, /standaloneSignInActive \? <PublishedProfileBoundary/);
});
