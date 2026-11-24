import assert from 'node:assert/strict';
import test from 'node:test';
import { readApplicationRoute, applicationRouteUrl, resolveApplicationDestination, disconnectRoute, studioOrigin } from './applicationNavigation.js';
const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const signedOut = { status: 'complete', profileAddress: null, ownershipVerified: false };
const owner = { status: 'complete', profileAddress: A, ownershipVerified: true };
const route = (search) => readApplicationRoute({ search });

test('URL intent recognizes current artist links and ignores removed profile hints', () => {
  assert.deepEqual(route('?discover&view=' + A), { kind: 'profile', address: A });
  assert.deepEqual(route('?discover'), { kind: 'home' });
  assert.deepEqual(route('?view=' + A + '&profile=' + B), { kind: 'profile', address: A });
  assert.deepEqual(route('?profile=' + B), { kind: 'home' });
  assert.deepEqual(route('?view=invalid'), { kind: 'home' });
});
test('entry, Workbench and public destinations depend on intent and verified authority', () => {
  assert.equal(resolveApplicationDestination(route(''), signedOut).kind, 'entry');
  assert.deepEqual(resolveApplicationDestination(route(''), owner), { kind: 'public', address: A, reception: 'published' });
  assert.equal(resolveApplicationDestination(route('?view=' + B), owner).kind, 'public');
  assert.equal(resolveApplicationDestination(route('?view=' + A), owner).kind, 'public');
  assert.equal(resolveApplicationDestination(route('?view=' + A), { ...owner, ownershipVerified: false }).kind, 'public');
});
test('pending authority cannot mount the owner or request an implicit publication', () => {
  const pending = { ...owner, status: 'pending' };
  assert.deepEqual(resolveApplicationDestination(route(''), pending), { kind: 'pending', address: null });
  assert.deepEqual(resolveApplicationDestination(route('?profile=' + B), pending), { kind: 'pending', address: null });
  assert.deepEqual(resolveApplicationDestination(route('?view=' + B), pending), { kind: 'public', address: B, reception: 'published' });
});
test('current account and current URL replace stale fallbacks without a remembered render target', () => {
  assert.equal(resolveApplicationDestination(route('?profile=' + B), owner).address, A);
  assert.equal(resolveApplicationDestination(route('?profile=' + B), signedOut).kind, 'entry');
  assert.equal(resolveApplicationDestination(route('?profile=' + A), signedOut).kind, 'entry');
  assert.equal(resolveApplicationDestination(route(''), { ...owner, profileAddress: B }).address, B);
});
test('navigation URLs remove competing destinations and preserve unrelated parameters and hashes', () => {
  const location = { href: 'https://example.test/?profile=' + A + '&view=' + B + '&keep=1#art' };
  assert.equal(applicationRouteUrl(location, { kind: 'home' }), '/?keep=1#art');
  assert.equal(applicationRouteUrl(location, { kind: 'profile', address: A }), '/?keep=1&view=' + A + '#art');
});
test('explicit disconnect drops the private return route but retains public visitor intent', () => {
  const home = route('');
  const publicRoute = route('?view=' + B);
  assert.deepEqual(disconnectRoute(home, resolveApplicationDestination(home, owner)), home);
  assert.equal(disconnectRoute(publicRoute, resolveApplicationDestination(publicRoute, owner)), publicRoute);
});

test('reception links retain the viewing route and focused destinations for a connected owner', () => {
  const expected = { kind: 'profile', address: A, reception: true, target: { moduleId: 'image:one' } };
  const href = applicationRouteUrl({ href: 'https://example.test/?keep=1' }, expected);
  assert.deepEqual(readApplicationRoute(new URL(href, 'https://example.test')), expected);
  assert.deepEqual(resolveApplicationDestination(expected, owner), { kind: 'public', address: A, reception: true, target: expected.target });
  assert.equal(resolveApplicationDestination({ kind: 'profile', address: A }, owner).kind, 'public');
  const home = applicationRouteUrl({ href: 'https://example.test' + href }, { kind: 'home' });
  assert.equal(home, '/?keep=1');
});

test('the public Gallery always reads published work and the private manager requires verified ownership', () => {
  const canvases = route('?view=' + A + '&canvas=1');
  const published = { ...canvases, reception: 'published' };
  assert.deepEqual(route('?view=' + A + '&tab=gallery'), published);
  assert.deepEqual(route('?view=' + A + '&canvas=1&reception=published'), published);
  for (const authority of [signedOut, owner, { ...owner, profileAddress: B }])
    assert.deepEqual(resolveApplicationDestination(published, authority), { ...published, kind: 'public' });
  for (const intent of [canvases, { ...canvases, reception: true }]) {
    assert.deepEqual(resolveApplicationDestination(intent, owner), { kind: 'workbench', address: A, canvas: true });
    for (const authority of [signedOut, { ...owner, status: 'pending' }, { ...owner, ownershipVerified: false }, { ...owner, profileAddress: B }]) {
      assert.deepEqual(resolveApplicationDestination(intent, authority), { ...intent, kind: 'public' });
    }
    const deepLink = { ...intent, target: { moduleId: 'text:one' } };
    assert.deepEqual(resolveApplicationDestination(deepLink, owner), { ...deepLink, kind: 'public' });
  }
  assert.deepEqual(resolveApplicationDestination(route('?view=' + A), owner), { kind: 'public', address: A, reception: 'published' });
});

test('Edit Reception uses the normal authorized Editor route and survives reload', () => {
  const edit = route('?view=' + A + '&editor=reception');
  assert.deepEqual(edit, { kind: 'profile', address: A, editor: 'reception' });
  assert.deepEqual(resolveApplicationDestination(edit, owner), {
    kind: 'workbench', address: A, receptionEditorRequested: true,
  });
  const href = applicationRouteUrl({ href: 'https://example.test/?keep=1&canvas=1&reception=1#art' }, edit);
  assert.equal(href, '/?keep=1&view=' + A + '&editor=studio&work=reception#art');
  assert.deepEqual(readApplicationRoute(new URL(href, 'https://example.test')), edit);
  assert.equal(applicationRouteUrl({ href: 'https://example.test' + href }, { kind: 'home' }), '/?keep=1#art');
  assert.deepEqual(disconnectRoute(edit, resolveApplicationDestination(edit, owner)), { kind: 'home' });
});

test('a selected published canvas opens only for its verified owner and round-trips through the URL', () => {
  const edit = route('?view=' + A + '&editor=canvas&work=workbench%3Aanatomy');
  const publicWorks = { kind: 'public', address: A, reception: 'published', canvas: true };
  assert.deepEqual(resolveApplicationDestination(edit, owner), { kind: 'workbench', address: A, worksEditorId: 'workbench:anatomy' });
  const href = applicationRouteUrl({ href: 'https://example.test/?canvas=1&reception=published' }, edit);
  assert.deepEqual(readApplicationRoute(new URL(href, 'https://example.test')), edit);
  for (const authority of [signedOut, { ...owner, status: 'pending' }, { ...owner, ownershipVerified: false }, { ...owner, profileAddress: B }]) {
    assert.deepEqual(resolveApplicationDestination(edit, authority), publicWorks);
  }
  for (const value of ['', 'reception', 'workbench:']) {
    const malformed = route('?view=' + A + '&editor=canvas&work=' + value);
    assert.deepEqual(resolveApplicationDestination(malformed, owner), publicWorks);
    assert.deepEqual(resolveApplicationDestination(malformed, signedOut), publicWorks);
  }
});

test('Reception editor intent never grants authority or exposes the editor to another account', () => {
  const edit = route('?view=' + A + '&editor=reception');
  for (const authority of [signedOut, { ...owner, status: 'pending' }, { ...owner, ownershipVerified: false }, { ...owner, profileAddress: B }]) {
    assert.deepEqual(resolveApplicationDestination(edit, authority), { kind: 'public', address: A, reception: true });
  }
  const competing = route('?view=' + A + '&editor=reception&reception=1&canvas=1&module=image:one');
  assert.deepEqual(competing, edit);
  assert.deepEqual(resolveApplicationDestination(competing, owner), { kind: 'workbench', address: A, receptionEditorRequested: true });
  assert.deepEqual(route('?view=' + A + '&editor=unknown&reception=1'), { kind: 'profile', address: A, reception: true });
});

test('Writing keeps the viewed identity and opens public content even for the owner', () => {
  const writing = { kind: 'profile', address: A, writing: true };
  const href = applicationRouteUrl({ href: 'https://example.test/?editor=studio&work=reception' }, writing);
  assert.deepEqual(route(new URL(href, 'https://example.test').search), writing);
  for (const viewer of [owner, signedOut]) {
    assert.deepEqual(resolveApplicationDestination(writing, viewer), { kind: 'public', address: A, writing: true });
  }
});

test('Studio opens the last document under verified authority and retains the public return destination when switching works', () => {
  const studio = route('?view=' + A + '&editor=studio');
  assert.deepEqual(resolveApplicationDestination(studio, owner), { kind: 'workbench', address: A });
  assert.equal(resolveApplicationDestination(studio, signedOut).kind, 'public');
  const profile = route('?view=' + A + '&reception=published');
  const gallery = route('?view=' + A + '&canvas=1');
  assert.equal(studioOrigin(profile, A), 'Profile');
  assert.equal(studioOrigin(gallery, A), 'Gallery');
  assert.equal(studioOrigin(studio, A, 'Profile'), 'Profile');
  assert.equal(studioOrigin(profile, B), 'Gallery');
  const create = route('?view=' + A + '&editor=studio&new=1');
  assert.equal(resolveApplicationDestination(create, owner).newComposition, true);
  assert.equal(resolveApplicationDestination(create, signedOut).newComposition, undefined);
});

test('profile visits retain the addressed artist across sign-in while home follows the connected account', () => {
  const viewer = { ...owner, signedInAddress: B, ownershipVerified: false };
  assert.deepEqual(resolveApplicationDestination(route(''), viewer), { kind: 'public', address: B, reception: 'published' });
  for (const authority of [signedOut, viewer, owner]) {
    assert.deepEqual(resolveApplicationDestination(route('?view=' + A), authority), { kind: 'public', address: A, reception: 'published' });
  }
  const ownPublicPage = route('?view=' + A + '&reception=published');
  assert.deepEqual(disconnectRoute(ownPublicPage, resolveApplicationDestination(ownPublicPage, owner), A), route(''));
  assert.equal(disconnectRoute(ownPublicPage, resolveApplicationDestination(ownPublicPage, viewer), B), ownPublicPage);
  assert.equal(studioOrigin(route(''), A), 'Profile');
  const studio = route('?view=' + A + '&editor=studio');
  assert.deepEqual(disconnectRoute(studio, resolveApplicationDestination(studio, owner)), route(''));
  assert.deepEqual(resolveApplicationDestination(route(''), signedOut), { kind: 'entry', address: null });
});
