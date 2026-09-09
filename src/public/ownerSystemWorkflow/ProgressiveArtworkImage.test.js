import assert from 'node:assert/strict';
import test from 'node:test';
import { progressiveArtworkSources } from './progressiveArtworkSources.js';

test('canvas media displays the thumbnail first but upgrades to the canonical source', () => {
  assert.deepEqual(progressiveArtworkSources({
    thumbnailUrl: 'https://assets.example/thumb.webp',
    previewSrc: 'https://assets.example/thumb.webp',
    src: 'https://assets.example/original.webp',
    originalImageUrl: 'https://assets.example/original.webp',
  }), {
    low: 'https://assets.example/thumb.webp',
    high: 'https://assets.example/original.webp',
  });
});

test('a single canonical source remains a valid progressive fallback', () => {
  assert.deepEqual(progressiveArtworkSources({ imageUrl: 'https://assets.example/only.png' }), {
    low: 'https://assets.example/only.png', high: 'https://assets.example/only.png',
  });
});
