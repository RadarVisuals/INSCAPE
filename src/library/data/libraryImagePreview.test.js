import assert from 'node:assert/strict';
import test from 'node:test';
import { libraryPreviewCandidates, libraryPreviewUrl, libraryFileFormat } from './libraryImagePreview.js';
import { assetForPlacement } from '../../systemWorkflow/domain/placementMedia.js';
import { imageHeaderDimensions, readImageHeaderDimensions } from './imageHeaderDimensions.js';

const original = 'https://api.universalprofile.cloud/image/QmArtwork/character.webp';
test('thumbnail size follows displayed size and density without mutating original media', () => {
  const group = { originalImageUrl: original, width: 2000, height: 1000 };
  assert.equal(new URL(libraryPreviewCandidates(group, 100, 2)[0]).searchParams.get('width'), '256');
  const asset = assetForPlacement({ imageGroups: [group] }, { selectedMedia: { url: original, width: 2000, height: 1000 } });
  assert.equal(asset.src, original); assert.equal(asset.originalImageUrl, original);
  assert.notEqual(asset.previewSrc, original);
  assert.equal(asset.selectedMedia.url, original);
  assert.equal(asset.imageWidth, 2000);
});
test('animated/vector and unrelated HTTP sources retain their original representation', () => {
  for (const source of [original.replace('.webp', '.svg'), original.replace('.webp', '.gif'), 'https://example.org/art.png'])
    assert.equal(libraryPreviewUrl(source, 256), source);
  assert.equal(libraryFileFormat(original, 'image/webp'), 'WEBP');
  assert.equal(libraryFileFormat('ipfs://QmArtwork/dialogue.txt', 'text/plain'), 'TXT');
});
test('proxy options retain source verification and remove conflicting density/height', () => {
  const url = new URL(libraryPreviewUrl(original + '?method=keccak256&data=0x123&dpr=2&height=500', 320));
  assert.equal(url.searchParams.get('data'), '0x123');
  assert.equal(url.searchParams.get('width'), '320');
  assert.equal(url.searchParams.has('dpr'), false); assert.equal(url.searchParams.has('height'), false);
});
test('headers yield native dimensions; cancelling the reader avoids downloading the artwork body', async () => {
  const png = new Uint8Array(24); png.set([137,80,78,71,13,10,26,10]);
  const view = new DataView(png.buffer); view.setUint32(16, 2000); view.setUint32(20, 1000);
  assert.deepEqual(imageHeaderDimensions(png), { width: 2000, height: 1000 });
  let cancelled = false, requested;
  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(png); }, cancel() { cancelled = true; } }));
  const result = await readImageHeaderDimensions('https://example.org/header.png', async (_url, options) => { requested = options; return response; });
  assert.equal(requested.headers.Range, 'bytes=0-65535');
  assert.equal(cancelled, true); assert.equal(result.width, 2000);
  assert.deepEqual(imageHeaderDimensions(new TextEncoder().encode('<svg width="720" height="800" viewBox="0 0 720 800">')), { width: 720, height: 800 });
  assert.deepEqual(imageHeaderDimensions(new TextEncoder().encode('<svg width="100%" height="100%" viewBox="0 0 960 540">')), { width: 960, height: 540 });
  assert.equal(imageHeaderDimensions(new Uint8Array([0,1,2])), null);
});
