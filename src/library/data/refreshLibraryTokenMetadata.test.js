import assert from 'node:assert/strict';
import test from 'node:test';
import { refreshLibraryTokenMetadata } from './refreshLibraryTokenMetadata.js';
import { metadataImages } from './metadataImages.js';
import { normalizeOwnedToken } from './chillwhalesProfileRepository.js';

const contract = '0x1111111111111111111111111111111111111111';
const token = (n) => ({ id: '42:' + contract + ':0x' + n.toString(16).padStart(64, '0'),
  standard: 'LSP8', contractAddress: contract, tokenId: '0x' + n.toString(16).padStart(64, '0'),
  ownerAddress: '0x2222222222222222222222222222222222222222', creators: [{ address: contract }],
  imageUrl: 'https://example.test/stale.webp', fieldProvenance: { creators: { scope: 'contract', source: 'LSP4Creators[]' } } });
const metadata = { name: 'Zero', description: 'Resident Zero', attributes: [],
  metadataSource: 'LSP4MetadataForTokenId (DIRECT LUKSO RPC)',
  images: [0, 1, 2, 3].map(index => ({ index, url: 'https://example.test/image-' + index + '.webp', width: 2000, height: 2000 })) };

test('an updated SVG with a spaced filename stays available through direct refresh and indexed metadata', async () => {
  const asset = { ...token(1), imageGroups: [{ index: 1, imageUrl: 'https://example.test/old-NOMAD.svg' }] };
  const before = structuredClone(asset);
  const attachment = { url: 'ipfs://QmbvP5gorFdpn2S67a8o74tUyFx73zJwk3u7PcuvwrwAh7/images-6-NOMAD-animated (3).svg', fileType: 'image/svg+xml' };
  const images = metadataImages({ images: [[{ url: 'https://example.test/cover.webp', width: 640 }]], assets: [attachment] });
  const resolver = { resolve: async () => new Map([[asset.tokenId, { ...metadata, images }]]) };
  const batches = [];
  for await (const batch of refreshLibraryTokenMetadata([asset], { resolver })) batches.push(batch);
  const fresh = batches[0].assets[0];
  assert.equal(batches[0].failures, 0);
  assert.equal(fresh.imageGroups.length, 2, 'the updated attachment must not silently disappear');
  assert.equal(fresh.imageGroups[1].imageUrl, 'https://api.universalprofile.cloud/ipfs/QmbvP5gorFdpn2S67a8o74tUyFx73zJwk3u7PcuvwrwAh7/images-6-NOMAD-animated%20(3).svg');
  assert.equal(fresh.id, asset.id);
  assert.equal(fresh.ownerAddress, asset.ownerAddress);
  assert.deepEqual(fresh.creators, asset.creators);
  assert.deepEqual(asset, before, 'refresh must not rewrite an existing placement or cached input');
  const indexed = normalizeOwnedToken({ address: contract, token_id: asset.tokenId,
    digitalAsset: { address: contract, lsp4TokenType: { value: 'COLLECTION' } },
    nft: { lsp4Metadata: { images: [{ image_index: 0, url: 'https://example.test/cover.webp', width: 640 }],
      assets: [{ url: attachment.url, file_type: attachment.fileType }] } },
  }, asset.ownerAddress);
  assert.deepEqual(indexed.imageGroups, fresh.imageGroups, 'both metadata paths use the same URL interpretation');
});

test('refresh replaces stale collection fallback with cover and all four token images, preserving authority', async () => {
  const asset = token(1); const before = structuredClone(asset);
  const resolver = { resolve: async () => new Map([[asset.tokenId, metadata]]) };
  const batches = [];
  for await (const batch of refreshLibraryTokenMetadata([asset], { resolver })) batches.push(batch);
  assert.equal(batches[0].failures, 0);
  const fresh = batches[0].assets[0];
  assert.equal(fresh.imageUrl, metadata.images[0].url);
  assert.equal(fresh.thumbnailUrl, metadata.images[0].url);
  assert.equal(fresh.imageGroups.length, 4);
  assert.equal(fresh.imageWidth, 2000);
  assert.equal(fresh.id, asset.id);
  assert.equal(fresh.ownerAddress, asset.ownerAddress);
  assert.deepEqual(fresh.creators, asset.creators);
  assert.deepEqual(fresh.fieldProvenance.creators, asset.fieldProvenance.creators);
  assert.equal(fresh.fieldProvenance.images.scope, 'tokenId');
  assert.deepEqual(asset, before);
});

test('unavailable token metadata retains existing records and reports incomplete refresh', async () => {
  const asset = token(1); const batches = [];
  for await (const batch of refreshLibraryTokenMetadata([asset], { resolver: { resolve: async () => new Map() } })) batches.push(batch);
  assert.deepEqual(batches, [{ assets: [], failures: 1 }]);
  assert.equal(asset.imageUrl, 'https://example.test/stale.webp');
});

test('many tokens use batches of at most eight and cancellation rejects obsolete results', async () => {
  const controller = new AbortController(); const sizes = [];
  const resolver = { resolve: async (_, assets) => {
    sizes.push(assets.length);
    if (sizes.length === 2) controller.abort();
    return new Map(assets.map(asset => [asset.tokenId, metadata]));
  } };
  let committed = 0;
  await assert.rejects(async () => {
    for await (const batch of refreshLibraryTokenMetadata(Array.from({ length: 20 }, (_, i) => token(i + 1)),
      { resolver, signal: controller.signal })) committed += batch.assets.length;
  }, { name: 'AbortError' });
  assert.deepEqual(sizes, [8, 8]);
  assert.equal(committed, 8);
});

test('a confirmed empty image list removes stale attachments rather than merging them back', async () => {
  const asset = token(1);
  for await (const batch of refreshLibraryTokenMetadata([asset], { resolver: {
    resolve: async () => new Map([[asset.tokenId, { ...metadata, images: [] }]]),
  } })) {
    assert.deepEqual(batch.assets[0].imageGroups, []);
    assert.equal(batch.assets[0].imageUrl, null);
    assert.equal(batch.assets[0].metadataStatus, 'partial');
  }
});
