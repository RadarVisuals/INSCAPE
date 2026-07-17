import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveContentUrl, selectImageUrls } from './resolveContentUrl.js';

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
