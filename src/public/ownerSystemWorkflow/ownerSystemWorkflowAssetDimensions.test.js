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
