import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLIC_PROFILE_PRESENTATION_STATUS,
  compactPublicProfileAddress,
  createUnresolvedPublicProfilePresentation,
  normalizePublicProfilePresentation,
  publicProfileResidentCode,
  selectPublicProfilePresentation,
} from './latticePublicProfilePresentation.js';

const ADDRESS = '0x0014567890abcdef1234567890abcdef12347584';
const resolvedProfile = (overrides = {}) => ({
  status: PUBLIC_PROFILE_PRESENTATION_STATUS.RESOLVED,
  official: {
    address: ADDRESS,
    handle: 'OFFICIAL HANDLE',
    avatarUrl: 'https://media.test/official.png',
    bio: 'Official public bio.',
    tags: ['ART'],
    network: 'LUKSO MAINNET',
    verified: true,
  },
  overlay: {
    alias: 'PUBLIC ALIAS',
    avatar: { mode: 'inscape', url: 'https://media.test/inscape.png', shape: 'round' },
    bio: { mode: 'inscape', text: 'Public INSCAPE bio.' },
    tags: ['ART', 'INSCAPE'],
  },
  counts: { assets: 7, collections: 2 },
  workspaceUrl: `https://inscape.test/${ADDRESS}`,
  ...overrides,
});

test('unresolved presentation is honest and contains no manufactured identity values', () => {
  const unresolved = createUnresolvedPublicProfilePresentation();
  assert.equal(unresolved.status, PUBLIC_PROFILE_PRESENTATION_STATUS.UNRESOLVED);
  assert.equal(unresolved.official.address, null);
  assert.equal(unresolved.official.verified, null);
  assert.equal(unresolved.workspaceUrl, null);
  assert.deepEqual(unresolved.counts, { assets: null, collections: null });
  assert.deepEqual(selectPublicProfilePresentation(unresolved).tags, []);
});

test('resident code and compact address derive only from the complete canonical address', () => {
  assert.equal(publicProfileResidentCode(ADDRESS), '001');
  assert.equal(compactPublicProfileAddress(ADDRESS), '0x001\u20267584');
  assert.equal(publicProfileResidentCode('0x001'), null);
  assert.equal(compactPublicProfileAddress(null), null);
});

test('resolved public projection selects active overlay values while preserving official identity', () => {
  const selected = selectPublicProfilePresentation(resolvedProfile());
  assert.equal(selected.displayName, 'PUBLIC ALIAS');
  assert.equal(selected.official.handle, 'OFFICIAL HANDLE');
  assert.equal(selected.avatarUrl, 'https://media.test/inscape.png');
  assert.equal(selected.bio, 'Public INSCAPE bio.');
  assert.deepEqual(selected.tags, ['ART', 'INSCAPE']);
  assert.equal(selected.residentCode, '001');
  assert.deepEqual(selected.counts, { assets: 7, collections: 2 });
});

test('inactive overlay avatar and bio values are redacted before rendering', () => {
  const normalized = normalizePublicProfilePresentation(resolvedProfile({
    overlay: {
      alias: null,
      avatar: { mode: 'official', url: 'https://private.test/inactive-avatar.png', shape: 'square' },
      bio: { mode: 'hidden', text: 'PRIVATE INACTIVE BIO' },
      tags: [],
    },
    counts: { assets: null, collections: null },
  }));
  assert.equal(normalized.overlay.avatar.url, null);
  assert.equal(normalized.overlay.bio.text, null);
  const selected = selectPublicProfilePresentation(normalized);
  assert.equal(selected.avatarUrl, 'https://media.test/official.png');
  assert.equal(selected.bio, null);
  assert.equal(selected.bioHidden, true);
});

test('invalid resolution, media and share URLs fail closed', () => {
  assert.deepEqual(normalizePublicProfilePresentation(resolvedProfile({
    official: { ...resolvedProfile().official, address: '0x001' },
  })), createUnresolvedPublicProfilePresentation());
  const normalized = normalizePublicProfilePresentation(resolvedProfile({
    official: { ...resolvedProfile().official, avatarUrl: 'javascript:alert(1)' },
    workspaceUrl: 'javascript:alert(1)',
  }));
  assert.equal(normalized.official.avatarUrl, null);
  assert.equal(normalized.workspaceUrl, null);
});
