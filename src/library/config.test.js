import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePublicHttpsEndpoint, normalizePublicHttpsEndpointList,
  resolveLibraryProfile, resolveWorkspaceProfile } from './config.js';

const HOST_PROFILE = '0x1111111111111111111111111111111111111111';
const ROUTE_PROFILE = '0x2222222222222222222222222222222222222222';

test('profile resolution has no implicit identity fallback', () => {
  assert.equal(resolveLibraryProfile({ search: '' }), null);
  assert.equal(resolveLibraryProfile({ search: '?profile=not-an-address' }), null);
});

test('the installed host profile is authoritative over a route profile', () => {
  assert.equal(resolveWorkspaceProfile(HOST_PROFILE, { search: `?profile=${ROUTE_PROFILE}` }), HOST_PROFILE);
  assert.equal(resolveWorkspaceProfile(null, { search: `?profile=${ROUTE_PROFILE}` }), ROUTE_PROFILE);
});

test('normalizes safe public HTTPS endpoints', () => {
  assert.equal(normalizePublicHttpsEndpoint(' https://gateway.example/ipfs/// '), 'https://gateway.example/ipfs/');
  assert.equal(normalizePublicHttpsEndpoint('http://gateway.example/ipfs/'), null);
  assert.equal(normalizePublicHttpsEndpoint('not a URL'), null);
  assert.equal(normalizePublicHttpsEndpoint('https://user:secret@gateway.example/ipfs/'), null);
});

test('filters unsafe and duplicate fallback endpoints', () => {
  assert.equal(normalizePublicHttpsEndpointList([
    'https://one.example/ipfs/',
    'http://unsafe.example/ipfs/',
    'https://one.example/ipfs',
    'https://two.example/ipfs/'
  ].join(',')), 'https://one.example/ipfs/,https://two.example/ipfs/');
});
