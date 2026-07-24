import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveContentUrl, selectImageGroups, selectImageUrls } from './resolveContentUrl.js';

test('resolves IPFS and web URLs while rejecting unsafe schemes', () => {
  assert.equal(resolveContentUrl('ipfs://ipfs/QmHash/file.png', { ipfsGateway: 'https://gw.test/ipfs/' }), 'https://gw.test/ipfs/QmHash/file.png');
  assert.equal(resolveContentUrl('https://example.test/image.png'), 'https://example.test/image.png');
  assert.equal(resolveContentUrl('javascript:alert(1)'), null);
  assert.equal(resolveContentUrl('data:text/html,bad'), null);
});

test('selects a modest thumbnail and the largest preview', () => {
  const urls = selectImageUrls([
    { src: 'https://example.test/small.png', width: 120 },
    { src: 'https://example.test/medium.png', width: 480 },
    { src: 'https://example.test/large.png', width: 1600 }
  ]);
  assert.equal(urls.thumbnailUrl, 'https://example.test/medium.png');
  assert.equal(urls.imageUrl, 'https://example.test/large.png');
});

test('keeps thumbnail and preview inside the first authored image group', () => {
  const urls = selectImageUrls([
    { index: 0, src: 'https://example.test/first-small.png', width: 180 },
    { index: 1, src: 'https://example.test/second-large.png', width: 2000 },
    { index: 0, src: 'https://example.test/first-large.png', width: 1200 }
  ]);
  assert.equal(urls.thumbnailUrl, 'https://example.test/first-large.png');
  assert.equal(urls.imageUrl, 'https://example.test/first-large.png');
});

test('root-relative content is accepted only for explicit trusted fixture use', () => {
  assert.equal(resolveContentUrl('/fixtures/avatar.svg'), null);
  assert.equal(resolveContentUrl('/fixtures/avatar.svg', { allowRelative: true }), '/fixtures/avatar.svg');
});

test('preserves distinct authored image indexes while selecting size variants within each group', () => {
  const groups = selectImageGroups([
    { index: 1, src: 'https://example.test/second.png', width: 900 },
    { index: 0, src: 'https://example.test/first-small.png', width: 180 },
    { index: 0, src: 'https://example.test/first-large.png', width: 1600 }
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.index), [0, 1]);
  assert.equal(groups[0].imageUrl, 'https://example.test/first-large.png');
  assert.equal(groups[0].thumbnailUrl, 'https://example.test/first-large.png');
  assert.equal(groups[0].variants.length, 2);
  assert.equal(groups[1].imageUrl, 'https://example.test/second.png');
});
