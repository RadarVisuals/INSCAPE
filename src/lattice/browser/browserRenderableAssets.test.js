import assert from 'node:assert/strict';
import test from 'node:test';
import {
  browserAssetSupportsPreview,
  decodeBrowserPreview,
  browserPreviewCandidates,
  browserPreviewWorkIsCurrent,
  resolveBrowserPreview,
} from './browserRenderableAssets.js';

test('preview candidates retain normalized thumbnail, display, original priority without duplicates', () => {
  assert.deepEqual(browserPreviewCandidates({ previewCandidates: ['thumb', 'display', 'original', 'display', null] }),
    ['thumb', 'display', 'original']);
  assert.deepEqual(browserPreviewCandidates({ previewSrc: 'thumb', src: 'original' }), ['thumb', 'original']);
});

test('browser preview decoding is bounded when a host never settles', async () => {
  class HangingImage {
    set src(_value) {}
    decode() { return new Promise(() => {}); }
  }
  await assert.rejects(decodeBrowserPreview('https://dead.example/image', HangingImage, 5),
    /timed out/);
});

test('preview resolution tries candidates locally and reveals only the first successful decode', async () => {
  const attempts = [];
  const result = await resolveBrowserPreview(['thumb', 'display', 'original'], async (source) => {
    attempts.push(source); if (source !== 'display') throw new Error('decode failed');
  });
  assert.deepEqual(result, { source: 'display', width: null, height: null });
  assert.deepEqual(attempts, ['thumb', 'display']);
  assert.equal(await resolveBrowserPreview(['thumb'], async () => { throw new Error('decode failed'); }), null);
});

test('only currently supported visual media enters preview decoding', () => {
  assert.equal(browserAssetSupportsPreview({ mediaType: 'image' }), true);
  assert.equal(browserAssetSupportsPreview({ mediaType: 'animation' }), true);
  assert.equal(browserAssetSupportsPreview({ mediaType: 'video' }), false);
  assert.equal(browserAssetSupportsPreview({ mediaType: 'audio' }), false);
  assert.equal(browserAssetSupportsPreview({ mediaType: 'unknown' }), false);
});

test('orphaned pending preview records restart after Strict Mode cleanup', () => {
  const asset = { stableAssetId: 'asset:a' };
  const signature = 'image\npreview';
  const pending = { assetRef: asset, signature, status: 'pending' };

  assert.equal(browserPreviewWorkIsCurrent(pending, null, asset, signature), false,
    'a pending record without a live job must restart');
  assert.equal(browserPreviewWorkIsCurrent(pending, { cancelled: false, signature }, asset, signature), true);
  assert.equal(browserPreviewWorkIsCurrent(pending, { cancelled: true, signature }, asset, signature), false);
  assert.equal(browserPreviewWorkIsCurrent({ ...pending, status: 'ready' }, null, asset, signature), true);
  assert.equal(browserPreviewWorkIsCurrent({ ...pending, status: 'unavailable' }, null, asset, signature), true);
  assert.equal(browserPreviewWorkIsCurrent({ ...pending, status: 'unavailable' }, null, { ...asset }, signature), false,
    'a refreshed asset record may retry an unavailable preview');
  assert.equal(browserPreviewWorkIsCurrent({ ...pending, status: 'ready' }, null, asset, 'image\nother'), false);
});
