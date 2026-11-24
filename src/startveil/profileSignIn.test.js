import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const login = read('./ProfileSignIn.jsx');
const startveil = read('./PortalStartveil.jsx');
const introStyles = read('./startveil.css');
const walletSession = read('../wallet/standaloneWalletSession.js');

test('bare entry uses an isolated sign-in surface with no directory acquisition', () => {
  assert.match(startveil, /portal && ready \? <ProfileSignIn onConnect=\{onConnect\}/);
  assert.match(login, /<button type="button" onClick=\{onConnect\}>Connect profile</);
  assert.doesNotMatch(startveil + login, /DiscoverDirectory|usePublishedProfile|useProfileDiscoveryController|PublishedWorldCard|selectFeaturedWorld/);
});

test('Connect Profile keeps the official UP Modal but presents it in the shared INSCAPE interface', () => {
  assert.match(walletSession, /theme: interfaceTheme.getSnapshot\(\).mode/);
  assert.match(introStyles, /--up-modal-font-family:\s*"Inscape Sora"/);
  assert.match(introStyles, /--up-modal-bg:\s*var\(--interface-panel/);
  assert.match(introStyles, /--up-modal-border-radius:\s*0px/);
});
