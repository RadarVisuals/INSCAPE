import assert from 'node:assert/strict';
import test from 'node:test';
import { detectImageTransparency, resetImageTransparencyCacheForTests } from './imageTransparency.js';

function installImageInspection(alpha) {
  const originals = { fetch: globalThis.fetch, createImageBitmap: globalThis.createImageBitmap, document: globalThis.document };
  globalThis.fetch = async () => ({ ok: true, blob: async () => ({}) });
  globalThis.createImageBitmap = async () => ({ width: 2, height: 2, close() {} });
  globalThis.document = { createElement: () => ({ getContext: () => ({ clearRect() {}, drawImage() {}, getImageData: () => ({ data: Uint8ClampedArray.from([1, 2, 3, alpha, 1, 2, 3, 255]) }) }) }) };
  return () => {
    globalThis.fetch = originals.fetch;
    globalThis.createImageBitmap = originals.createImageBitmap;
    globalThis.document = originals.document;
    resetImageTransparencyCacheForTests();
  };
}

test('detects transparent and opaque original artwork pixels', async () => {
  let restore = installImageInspection(0);
  try { assert.equal(await detectImageTransparency('https://example.test/transparent.webp'), true); } finally { restore(); }
  restore = installImageInspection(255);
  try { assert.equal(await detectImageTransparency('https://example.test/opaque.webp'), false); } finally { restore(); }
});

test('failed image inspection remains retryable', async () => {
  const restore = installImageInspection(0);
  const successfulFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (...args) => (++calls === 1 ? Promise.reject(new Error('temporary gateway failure')) : successfulFetch(...args));
  try {
    assert.equal(await detectImageTransparency('https://example.test/retry.webp'), false);
    assert.equal(await detectImageTransparency('https://example.test/retry.webp'), true);
    assert.equal(calls, 2);
  } finally { restore(); }
});
