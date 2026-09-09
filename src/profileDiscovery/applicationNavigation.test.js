import assert from 'node:assert/strict';
import test from 'node:test';
import { readApplicationRoute, applicationRouteUrl, resolveApplicationDestination, disconnectRoute } from './applicationNavigation.js';
const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const signedOut = { status: 'complete', profileAddress: null, ownershipVerified: false };
const owner = { status: 'complete', profileAddress: A, ownershipVerified: true };
const route = (search) => readApplicationRoute({ search });

test('URL intent has explicit precedence and retains the legacy profile fallback', () => {
  assert.deepEqual(route('?discover&view=' + A), { kind: 'discover', returnTo: null });
  assert.deepEqual(route('?view=' + A + '&profile=' + B), { kind: 'profile', address: A });
  assert.deepEqual(route('?profile=' + B), { kind: 'home', fallbackAddress: B });
  assert.deepEqual(route('?view=invalid'), { kind: 'home', fallbackAddress: null });
  assert.deepEqual(readApplicationRoute({ search: '?discover' }, { inscapeReturnRoute: { kind: 'discover', returnTo: {} } }), { kind: 'discover', returnTo: null });
});
test('entry, Discover, Workbench and public destinations depend on intent and verified authority', () => {
  assert.equal(resolveApplicationDestination(route(''), signedOut).kind, 'entry');
  assert.equal(resolveApplicationDestination(route(''), owner).kind, 'workbench');
  assert.equal(resolveApplicationDestination(route('?discover'), owner).kind, 'discover');
  assert.equal(resolveApplicationDestination(route('?view=' + B), owner).kind, 'public');
  assert.equal(resolveApplicationDestination(route('?view=' + A), owner).kind, 'workbench');
  assert.equal(resolveApplicationDestination(route('?view=' + A), { ...owner, ownershipVerified: false }).kind, 'public');
});
test('pending authority cannot mount the owner or request an implicit publication', () => {
  const pending = { ...owner, status: 'pending' };
  assert.deepEqual(resolveApplicationDestination(route(''), pending), { kind: 'pending', address: null });
  assert.deepEqual(resolveApplicationDestination(route('?profile=' + B), pending), { kind: 'pending', address: null });
  assert.deepEqual(resolveApplicationDestination(route('?view=' + B), pending), { kind: 'public', address: B });
});
test('current account and current URL replace stale fallbacks without a remembered render target', () => {
  assert.equal(resolveApplicationDestination(route('?profile=' + B), owner).address, A);
  assert.equal(resolveApplicationDestination(route('?profile=' + B), signedOut).address, B);
  assert.equal(resolveApplicationDestination(route('?profile=' + A), signedOut).address, A);
  assert.equal(resolveApplicationDestination(route(''), { ...owner, profileAddress: B }).address, B);
});
test('navigation URLs remove competing destinations and preserve unrelated parameters and hashes', () => {
  const location = { href: 'https://example.test/?profile=' + A + '&view=' + B + '&discover&keep=1#art' };
  assert.equal(applicationRouteUrl(location, { kind: 'home' }), '/?keep=1#art');
  assert.equal(applicationRouteUrl(location, { kind: 'profile', address: A }), '/?keep=1&view=' + A + '#art');
  assert.equal(applicationRouteUrl(location, { kind: 'discover' }), '/?keep=1&discover=#art');
});
test('explicit disconnect drops the private return route but retains public visitor intent', () => {
  const home = route('');
  const publicRoute = route('?view=' + B);
  assert.deepEqual(disconnectRoute(home, resolveApplicationDestination(home, owner)), { kind: 'discover', returnTo: null });
  const overlay = { kind: 'discover', returnTo: home };
  assert.deepEqual(disconnectRoute(overlay, resolveApplicationDestination(home, owner)), { kind: 'discover', returnTo: null });
  assert.equal(disconnectRoute(publicRoute, resolveApplicationDestination(publicRoute, owner)), publicRoute);
  const publicOverlay = { kind: 'discover', returnTo: publicRoute };
  assert.equal(disconnectRoute(publicOverlay, resolveApplicationDestination(publicRoute, owner)), publicOverlay);
});
