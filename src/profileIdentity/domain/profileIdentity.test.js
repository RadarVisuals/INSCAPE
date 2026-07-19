import assert from 'node:assert/strict';
import test from 'node:test';
import { getOfficialProfileUrl, LSP3_METADATA_LIMITS, normalizeLsp3Identity, PROFILE_IDENTITY_STATUS, selectProfileAvatar } from './profileIdentity.js';

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

test('normalizes canonical addresses and public LSP3 text', () => {
  const identity = normalizeLsp3Identity(ADDRESS.toUpperCase().replace('0X', '0x'), {
    name: '  RADAR\u0000  SIGNAL  ',
    description: ' public ',
    profileImage: [{ url: 'ipfs://avatar', width: 96 }],
    tags: [' art\u0007 direction ', 'animation'],
    links: [{ title: ' Portfolio\u0000 ', url: 'ipfs://portfolio/index.html' }]
  }, { ipfsGateway: 'https://gw.test/ipfs/' });
  assert.equal(identity.normalizedAddress, ADDRESS);
  assert.equal(identity.name, 'RADAR SIGNAL');
  assert.equal(identity.description, 'public');
  assert.equal(identity.avatarUrl, 'https://gw.test/ipfs/avatar');
  assert.deepEqual(identity.tags, ['art direction', 'animation']);
  assert.deepEqual(identity.links, [{ id: 'lsp3-link-1', label: 'Portfolio', url: 'https://gw.test/ipfs/portfolio/index.html' }]);
  assert.equal(identity.status, PROFILE_IDENTITY_STATUS.RESOLVED);
});

test('keeps a profile when optional LSP3 fields are missing', () => {
  const identity = normalizeLsp3Identity(ADDRESS, { name: 'Name only' });
  assert.equal(identity.description, null);
  assert.equal(identity.avatarUrl, null);
  assert.deepEqual(identity.tags, []);
  assert.deepEqual(identity.links, []);
});

test('ignores malformed tags and links individually and rejects unsafe URL protocols', () => {
  const identity = normalizeLsp3Identity(ADDRESS, {
    tags: [null, '', 'valid', { label: 'bad' }, 'also valid'],
    links: [
      null,
      { title: 'Missing URL' },
      { title: 'Script', url: 'javascript:alert(1)' },
      { title: 'Control', url: 'https://example.com/\u0000bad' },
      { title: 'Website', url: 'https://example.com/profile' },
      { title: 'FTP', url: 'ftp://example.com/file' }
    ]
  });
  assert.deepEqual(identity.tags, ['valid', 'also valid']);
  assert.deepEqual(identity.links, [{ id: 'lsp3-link-1', label: 'Website', url: 'https://example.com/profile' }]);
});

test('bounds long LSP3 strings and list sizes', () => {
  const identity = normalizeLsp3Identity(ADDRESS, {
    name: 'n'.repeat(500),
    description: 'd'.repeat(1000),
    tags: Array.from({ length: 30 }, (_, index) => `${index}-${'t'.repeat(100)}`),
    links: Array.from({ length: 20 }, (_, index) => ({ title: `Link ${index}`, url: `https://example.com/${index}` }))
  });
  assert.equal(identity.name.length, LSP3_METADATA_LIMITS.name);
  assert.equal(identity.description.length, LSP3_METADATA_LIMITS.description);
  assert.equal(identity.tags.length, LSP3_METADATA_LIMITS.tags);
  assert.ok(identity.tags.every((tag) => tag.length <= LSP3_METADATA_LIMITS.tag));
  assert.equal(identity.links.length, LSP3_METADATA_LIMITS.links);
});

test('bounds hostile names and never interprets their markup', () => {
  const identity = normalizeLsp3Identity(ADDRESS, { name: '<script>alert(1)</script>'.repeat(20) });
  assert.equal(identity.name.length, 80);
  assert.match(identity.name, /^<script>/);
});

test('selects the smallest suitable safe avatar and resolves IPFS', () => {
  const avatar = selectProfileAvatar([{ url: 'ipfs://large', width: 1200 }, { url: 'ipfs://small', width: 96 }, { url: 'javascript:bad', width: 64 }], { ipfsGateway: 'https://gw.test/ipfs/' });
  assert.equal(avatar, 'https://gw.test/ipfs/small');
});

test('constructs official links from addresses only', () => {
  assert.equal(getOfficialProfileUrl(ADDRESS), `https://universaleverything.io/${ADDRESS}`);
  assert.equal(getOfficialProfileUrl('invalid'), null);
  assert.equal(normalizeLsp3Identity('invalid', { name: 'No' }), null);
  assert.equal(normalizeLsp3Identity(ADDRESS, []), null);
});
