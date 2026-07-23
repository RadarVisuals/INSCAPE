import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNftViewerPages, compactAddress, compactTokenId, nftViewerPageRatio } from './nftFlipViewerModel.js';

test('viewer preserves unique media order before the three metadata faces', () => {
  const pages = buildNftViewerPages({ media: ['first.webp', 'second.webp', 'first.webp'], originalImageUrl: 'master.webp', imageUrl: 'display.webp' });
  assert.deepEqual(pages.map(({ kind }) => kind), ['media', 'media', 'story', 'traits', 'record']);
  assert.deepEqual(pages.slice(0, 2).map(({ url }) => url), ['first.webp', 'second.webp']);
  const fallbackPage = buildNftViewerPages({ originalImageUrl: 'master.webp', imageUrl: 'display.webp', thumbnailUrl: 'thumb.webp' }).find(({ kind }) => kind === 'media');
  assert.deepEqual(fallbackPage.sources, ['display.webp', 'thumb.webp', 'master.webp']);
});

test('viewer ratios and on-chain labels fail closed', () => {
  assert.equal(nftViewerPageRatio({ kind: 'media', url: 'a' }, { a: 1.5 }), 1.5);
  assert.equal(nftViewerPageRatio({ kind: 'story' }, { a: 1.5 }), 1);
  assert.equal(compactTokenId(null), 'COLLECTION');
  assert.equal(compactAddress(null), 'UNAVAILABLE');
  assert.equal(compactAddress('0x1234567890abcdef1234'), '0x123456…ef1234');
});
