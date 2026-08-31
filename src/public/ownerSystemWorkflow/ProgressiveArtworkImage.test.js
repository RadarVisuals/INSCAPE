import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { progressiveArtworkSources } from './progressiveArtworkSources.js';

const component = readFileSync(new URL('./ProgressiveArtworkImage.jsx', import.meta.url), 'utf8');

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
  assert.deepEqual(progressiveArtworkSources({ imageUrl: 'https://assets.example/alpha.webp' }), {
    low: 'https://assets.example/alpha.webp', high: 'https://assets.example/alpha.webp',
  });
});

test('single-source WebP and progressive artwork share the alpha-selection media contract', () => {
  assert.match(component, /sources\.low === sources\.high[\s\S]*<img[^>]*className="system-workflow__artwork-media"/);
  assert.match(component, /<span className="system-workflow__artwork-media system-workflow__progressive-media"/);
});
