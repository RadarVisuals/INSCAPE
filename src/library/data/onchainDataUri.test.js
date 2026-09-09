import assert from 'node:assert/strict';
import test from 'node:test';
import { keccak256 } from 'viem';
import {
  decodeVerifiedOnchainJsonDataUri,
  inspectOnchainSvgDataUri,
  isSafeOnchainSvgDataUri,
  resolveVerifiedOnchainSvgDataUri,
} from './onchainDataUri.js';

const bytes = (value) => new TextEncoder().encode(value);
const verification = (value, method = 'keccak256(bytes)') => ({ method, data: keccak256(bytes(value)) });
const svgUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1025 1025"><rect width="1025" height="1025" fill="#202020"/></svg>';

test('decodes only authentic bounded on-chain LSP4 JSON data URIs', () => {
  const json = JSON.stringify({ LSP4Metadata: { images: [[{ width: 768, height: 768, url: svgUri(SVG) }]] } });
  const uri = `data:application/json;charset=UTF-8,${encodeURIComponent(json)}`;
  assert.deepEqual(decodeVerifiedOnchainJsonDataUri(uri, verification(json, 'keccak256(utf8)')),
    JSON.parse(json));
  assert.equal(decodeVerifiedOnchainJsonDataUri(uri, { method: 'keccak256(utf8)', data: `0x${'00'.repeat(32)}` }), null);
  assert.equal(decodeVerifiedOnchainJsonDataUri('data:text/html,%3Cscript%3E', verification('<script>')), null);
});

test('accepts authentic inert SVG image data while rejecting active, external, and unverified payloads', () => {
  const uri = svgUri(SVG);
  const proof = verification(SVG);
  assert.equal(resolveVerifiedOnchainSvgDataUri(uri, proof), uri);
  assert.equal(inspectOnchainSvgDataUri(uri, proof)?.svg, SVG);
  assert.equal(resolveVerifiedOnchainSvgDataUri(uri, { ...proof, data: `0x${'00'.repeat(32)}` }), null);
  assert.equal(resolveVerifiedOnchainSvgDataUri(uri, null), null);

  for (const svg of [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>html</div></foreignObject></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://tracker.example/pixel"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
  ]) assert.equal(isSafeOnchainSvgDataUri(svgUri(svg)), false, svg);
});

test('published on-chain SVG validation is content-bounded and independent of an NFT-specific type', () => {
  assert.equal(isSafeOnchainSvgDataUri(svgUri(SVG)), true);
  const burntPixScale = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1025 1025"><desc>${'x'.repeat(192_000)}</desc></svg>`;
  assert.ok(svgUri(burntPixScale).length > 256_000);
  assert.equal(isSafeOnchainSvgDataUri(svgUri(burntPixScale)), true);
  assert.equal(isSafeOnchainSvgDataUri('data:image/png;base64,AAAA'), false);
  assert.equal(isSafeOnchainSvgDataUri('data:image/svg+xml,%3Csvg%3E'), false);
});
