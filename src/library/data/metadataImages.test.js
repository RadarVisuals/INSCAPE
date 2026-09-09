import assert from 'node:assert/strict';
import test from 'node:test';
import { metadataImages } from './metadataImages.js';
import { selectImageGroups } from './resolveContentUrl.js';
import { normalizeOwnedToken } from './chillwhalesProfileRepository.js';

test('keeps image resolutions together and exposes attached images beside the main preview', () => {
  const images = metadataImages({ images: [[
    { url: 'https://art.test/small.png', width: 320 }, { url: 'https://art.test/main.png', width: 1200 },
  ], [{ url: 'https://art.test/pose.png', width: 600 }]], assets: [
    { url: 'https://art.test/transparent', fileType: 'image/png' },
    { url: 'https://art.test/main.png', fileType: 'png' },
    { url: 'https://art.test/story.pdf', fileType: 'application/pdf' },
    { url: 'https://art.test/unknown' },
  ] });
  const groups = selectImageGroups(images);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].variants.length, 2);
  assert.equal(groups[0].imageUrl, 'https://art.test/main.png');
  assert.equal(groups[2].imageUrl, 'https://art.test/transparent');
});

test('indexer token normalization preserves attachments even with a normal main image', () => {
  const asset = normalizeOwnedToken({ address: '0x2222222222222222222222222222222222222222', token_id: '0x01',
    digitalAsset: { address: '0x2222222222222222222222222222222222222222', lsp4TokenType: { value: 'COLLECTION' } },
    nft: { lsp4Metadata: { images: [{ image_index: 0, url: 'https://art.test/main.png', width: 1200 }],
      assets: [{ url: 'https://art.test/transparent.png', file_type: 'image/png' }] } },
  }, '0x1111111111111111111111111111111111111111');
  assert.equal(asset.tokenId, '0x01');
  assert.deepEqual(asset.imageGroups.map(({ imageUrl }) => imageUrl), ['https://art.test/main.png', 'https://art.test/transparent.png']);
});
