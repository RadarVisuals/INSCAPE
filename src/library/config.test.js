import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLibraryProfile, resolveWorkspaceProfile } from './config.js';

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
