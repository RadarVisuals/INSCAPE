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

test('a cover, four XML-labelled SVGs and three WebPs remain eight separate resources', () => {
  const metadata = { images: [[{ url: 'https://art.test/cover.webp', width: 1200 },
    { url: 'https://art.test/cover-small.webp', width: 320 }]], assets: [
    ...Array.from({ length: 4 }, (_, i) => ({ url: `https://art.test/creature-${i}.svg`, fileType: 'application/xml; charset=UTF-8' })),
    ...Array.from({ length: 3 }, (_, i) => ({ url: `https://art.test/pose-${i}.webp`, fileType: 'image/webp' })),
  ] };
  const before = structuredClone(metadata);
  const groups = selectImageGroups(metadataImages(metadata));
  assert.equal(groups.length, 8);
  assert.equal(groups[0].variants.length, 2, 'resolution variants are still one preview');
  assert.deepEqual(groups.slice(1).map(group => group.imageUrl), metadata.assets.map(asset => asset.url));
  assert.equal(groups[1].fileType, metadata.assets[0].fileType, 'the declared source type is retained');
  assert.deepEqual(metadata, before);

  const indexed = normalizeOwnedToken({ address: '0x2222222222222222222222222222222222222222', token_id: '0x04',
    digitalAsset: { address: '0x2222222222222222222222222222222222222222', lsp4TokenType: { value: 'COLLECTION' } },
    nft: { lsp4Metadata: { images: metadata.images[0].map(image => ({ ...image, image_index: 0 })),
      assets: metadata.assets.map(({ fileType, ...asset }) => ({ ...asset, file_type: fileType })) } },
  }, '0x1111111111111111111111111111111111111111');
  assert.deepEqual(indexed.imageGroups, groups, 'indexer and direct metadata share the same interpretation');
});

test('XML SVG detection uses the path, preserves duplicates as one choice and excludes unrelated documents', () => {
  const accepted = [
    { url: 'https://art.test/creature.SVG?version=2#view', fileType: ' TEXT/XML ; charset=UTF-8' },
    { url: 'https://art.test/extensionless', fileType: ' image/svg+xml ; charset=UTF-8' },
    { url: 'https://art.test/no-type.svg' },
  ];
  const rejected = [
    { url: 'https://art.test/ordinary.xml', fileType: 'application/xml' },
    { url: 'https://art.test/ordinary.xml?name=creature.svg', fileType: 'application/xml' },
    { url: 'https://art.test/extensionless-xml', fileType: 'text/xml' },
    { url: 'https://art.test/not-art.svg', fileType: 'application/pdf' },
    { url: 'https://art.test/page.svg', fileType: 'text/html' },
  ];
  const images = metadataImages({ assets: [...accepted, ...rejected, accepted[0]] });
  assert.deepEqual(images.map(image => image.url), accepted.map(image => image.url));
});

test('attachment discovery has no four- or eight-image cap', () => {
  const assets = Array.from({ length: 64 }, (_, i) => ({ url: `https://art.test/pose-${i}.svg`, fileType: 'application/xml' }));
  assert.equal(selectImageGroups(metadataImages({ assets })).length, assets.length);
});
