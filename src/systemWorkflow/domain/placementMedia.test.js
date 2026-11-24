import assert from 'node:assert/strict';
import test from 'node:test';
import { assetForPlacement } from './placementMedia.js';

const profile = '0x1111111111111111111111111111111111111111';
const contractAddress = '0x2222222222222222222222222222222222222222';
const asset = { id: `42:${contractAddress}:0x01`, chainId: 42, contractAddress, tokenId: '0x01', standard: 'LSP8',
  name: 'Character', imageUrl: 'https://art.test/portrait.png', imageWidth: 1200, imageHeight: 1200 };
const selectedMedia = { url: 'https://art.test/transparent.png', width: 400, height: 900 };

test('selected artwork media keeps the original token and its chosen image', () => {
  assert.equal(assetForPlacement(asset, {}).imageUrl, asset.imageUrl);
  const media = assetForPlacement(asset, { selectedMedia });
  assert.equal(media.id, asset.id);
  assert.equal(media.src, selectedMedia.url);
  assert.equal(media.width, 400);
  assert.equal(media.height, 900);
});

test('selected image validates URLs, dimensions, and exact structure at the artwork boundary', () => {
  for (const media of [
    { ...selectedMedia, url: 'javascript:alert(1)' }, { ...selectedMedia, width: -1 },
    { ...selectedMedia, extra: true }, { url: selectedMedia.url },
  ]) {
    assert.throws(() => assetForPlacement(asset, { selectedMedia: media }));
  }
});
