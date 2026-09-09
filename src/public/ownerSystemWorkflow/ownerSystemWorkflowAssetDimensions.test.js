import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeOwnerSystemWorkflowAssetDimensions,
  ownerSystemWorkflowAssetDimensions,
  ownerSystemWorkflowDecodedAsset,
} from './ownerSystemWorkflowAssetDimensions.js';

test('canonical image dimensions win over ambiguous display dimensions', () => {
  assert.deepEqual(ownerSystemWorkflowAssetDimensions({
    imageWidth: 2000,
    imageHeight: 2000,
    width: 320,
    height: 180,
  }), { width: 2000, height: 2000 });
});

test('legacy dimensions remain a bounded fallback', () => {
  assert.deepEqual(ownerSystemWorkflowAssetDimensions({ width: 1200, height: 800 }), { width: 1200, height: 800 });
  assert.equal(ownerSystemWorkflowAssetDimensions({ width: 1200 }), null);
});

test('source-bound browser-decoded dimensions override pre-orientation metadata', () => {
  const source = 'https://assets.example/phone.jpg';
  const decoded = ownerSystemWorkflowDecodedAsset({
    src: source,
    imageWidth: 1920,
    imageHeight: 1080,
  }, { source, width: 1080, height: 1920 });
  assert.deepEqual(ownerSystemWorkflowAssetDimensions(decoded), { width: 1080, height: 1920 });
  assert.equal(decoded.imageWidth, 1080);
  assert.equal(decoded.imageHeight, 1920);
  assert.deepEqual(ownerSystemWorkflowAssetDimensions(ownerSystemWorkflowDecodedAsset(decoded, {
    source: 'https://assets.example/thumbnail.jpg', width: 90, height: 160,
  })), { width: 1080, height: 1920 }, 'a thumbnail decode cannot replace source dimensions');
});

test('a successfully decoded fallback becomes the canonical render and placement source', () => {
  const stale = 'https://dead.example/image';
  const fallback = 'https://gateway.example/ipfs/work';
  const decoded = ownerSystemWorkflowDecodedAsset({
    src: stale,
    previewCandidates: [stale, fallback],
    imageWidth: 2000,
    imageHeight: 1000,
  }, { source: fallback, width: 1000, height: 2000 });
  assert.equal(decoded.src, fallback);
  assert.equal(decoded.previewSrc, fallback);
  assert.equal(decoded.decodedImageSource, fallback);
  assert.deepEqual(ownerSystemWorkflowAssetDimensions(decoded), { width: 1000, height: 2000 });
});

test('browser decoding preserves portrait, landscape, and square natural dimensions after orientation', async () => {
  const cases = [
    ['portrait', 1080, 1920],
    ['landscape', 1920, 1080],
    ['square', 1200, 1200],
  ];
  for (const [name, width, height] of cases) {
    class FakeImage {
      set src(value) {
        this.source = value;
        this.naturalWidth = width;
        this.naturalHeight = height;
      }
      decode() { return Promise.resolve(); }
    }
    const source = `https://assets.example/${name}.jpg`;
    assert.deepEqual(await decodeOwnerSystemWorkflowAssetDimensions({ src: source }, {
      ImageConstructor: FakeImage, cache: new Map(),
    }), { source, width, height });
  }
});

test('failed or unavailable decoding stays unknown instead of inventing dimensions', async () => {
  class FailedImage {
    set src(_value) { queueMicrotask(() => this.onerror()); }
    decode() { return Promise.reject(new Error('decode failed')); }
  }
  assert.equal(await decodeOwnerSystemWorkflowAssetDimensions({ src: 'https://assets.example/missing.jpg' }, {
    ImageConstructor: FailedImage, cache: new Map(),
  }), null);
  assert.equal(ownerSystemWorkflowAssetDimensions({ imageWidth: null, imageHeight: null }), null);
});

test('dimension decoding skips a failed source and accepts the next bounded candidate', async () => {
  class CandidateImage {
    set src(value) {
      this.source = value;
      if (value.includes('fallback')) {
        this.naturalWidth = 1600; this.naturalHeight = 900;
        queueMicrotask(() => this.onload());
      } else queueMicrotask(() => this.onerror());
    }
    decode() { return Promise.reject(new Error('use load events')); }
  }
  assert.deepEqual(await decodeOwnerSystemWorkflowAssetDimensions({
    src: 'https://dead.example/image',
    previewCandidates: ['https://dead.example/image', 'https://gateway.example/fallback'],
  }, { ImageConstructor: CandidateImage, cache: new Map(), timeoutMs: 20 }), {
    source: 'https://gateway.example/fallback', width: 1600, height: 900,
  });
});

test('synchronous image failures are retryable and do not poison the source cache', async () => {
  const cache = new Map(); const asset = { src: 'https://assets.example/retry' };
  for (const ImageConstructor of [class { constructor() { throw new Error('constructor'); } },
    class { set src(_) { throw new Error('source setter'); } },
    class { decode() { throw new Error('decode'); } }]) {
    assert.equal(await decodeOwnerSystemWorkflowAssetDimensions(asset, { ImageConstructor, cache }), null);
    assert.equal(cache.size, 0);
  }
  class WorkingImage {
    naturalWidth = 100; naturalHeight = 200;
    decode() { return Promise.resolve(); }
  }
  assert.deepEqual(await decodeOwnerSystemWorkflowAssetDimensions(asset, { ImageConstructor: WorkingImage, cache }),
    { source: asset.src, width: 100, height: 200 });
});

test('concurrent requests share decoding and timed-out sources release their cache entry', async () => {
  const cache = new Map(); let count = 0; let instance;
  class DelayedImage { constructor() { count++; instance = this; } }
  const options = { cache, ImageConstructor: DelayedImage, timeoutMs: 10 };
  const asset = { src: 'https://assets.example/delayed' };
  const first = decodeOwnerSystemWorkflowAssetDimensions(asset, options);
  const second = decodeOwnerSystemWorkflowAssetDimensions(asset, options);
  assert.equal(count, 1);
  assert.deepEqual(await Promise.all([first, second]), [null, null]);
  assert.equal(cache.size, 0);
  assert.equal(instance.onload, null);
  assert.equal(instance.onerror, null);
});

test('long sessions keep a bounded cache and retain recently reused dimensions', async () => {
  const cache = new Map();
  class LoadedImage {
    naturalWidth = 20; naturalHeight = 40;
    decode() { return Promise.resolve(); }
  }
  const decode = (id) => decodeOwnerSystemWorkflowAssetDimensions({ src: `https://assets.example/${id}` }, { cache, ImageConstructor: LoadedImage });
  for (let id = 0; id < 256; id++) await decode(id);
  await decode(0); await decode(256);
  assert.equal(cache.size, 256);
  assert.equal(cache.has('https://assets.example/0'), true);
  assert.equal(cache.has('https://assets.example/1'), false);
});


test('Library thumbnail dimensions never stand in for the placement source decode', async () => {
  const source = 'https://assets.example/full.webp';
  const requested = [];
  class FullImage {
    set src(value) { requested.push(value); this.naturalWidth = 2000; this.naturalHeight = 1500; }
    decode() { return Promise.resolve(); }
  }
  for (const size of [180, 320, 640]) {
    const asset = { src: source, previewSrc: 'https://assets.example/' + size + '.webp',
      decodedImageSource: 'https://assets.example/' + size + '.webp', decodedImageWidth: size,
      decodedImageHeight: size, width: 2000, height: 1500 };
    assert.deepEqual(ownerSystemWorkflowAssetDimensions(asset), { width: 2000, height: 1500 });
    assert.deepEqual(await decodeOwnerSystemWorkflowAssetDimensions(asset, { ImageConstructor: FullImage, cache: new Map() }),
      { source, width: 2000, height: 1500 });
  }
  assert.deepEqual(requested, [source, source, source]);
});

test('a cached thumbnail cannot supply a missing source dimension or claim a source is decoded', async () => {
  const source = 'https://assets.example/full.webp';
  const asset = { src: source, previewSrc: 'https://assets.example/640.webp',
    decodedImageSource: 'https://assets.example/640.webp', decodedImageWidth: 640, decodedImageHeight: 640 };
  assert.equal(ownerSystemWorkflowAssetDimensions(asset), null);
  let requested;
  class FullImage {
    set src(value) { requested = value; this.naturalWidth = 1000; this.naturalHeight = 2000; }
    decode() { return Promise.resolve(); }
  }
  const selected = { ...asset, selectedMedia: { url: 'https://assets.example/selected.webp', width: 1000, height: 2000 } };
  assert.equal((await decodeOwnerSystemWorkflowAssetDimensions(selected, { ImageConstructor: FullImage, cache: new Map() })).source,
    selected.selectedMedia.url);
  assert.equal(requested, selected.selectedMedia.url);
});
