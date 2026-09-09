import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePublishedAssetUrl, resolvePublishedAssetUrl } from './publishedAssetUrl.js';

const CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>';
const SVG_URI = `data:image/svg+xml;base64,${Buffer.from(SVG).toString('base64')}`;

test('published asset URLs accept absolute HTTPS and strict IPFS references', () => {
  assert.equal(parsePublishedAssetUrl('https://images.example/art.png')?.scheme, 'https');
  assert.equal(parsePublishedAssetUrl(`ipfs://${CID}/art.png`)?.scheme, 'ipfs');
  assert.equal(resolvePublishedAssetUrl(`ipfs://${CID}/art.png`, { ipfsGateway: 'https://gateway.example/ipfs/' }), `https://gateway.example/ipfs/${CID}/art.png`);
});

test('published asset URLs accept only bounded inert base64 SVG data media', () => {
  assert.equal(parsePublishedAssetUrl(SVG_URI)?.scheme, 'data');
  assert.equal(resolvePublishedAssetUrl(SVG_URI), SVG_URI);
  const active = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>').toString('base64')}`;
  assert.equal(parsePublishedAssetUrl(active), null);
});

test('published asset URLs reject insecure, local, ambiguous, credentialed, and malformed values', () => {
  for (const value of [
    'http://images.example/art.png', '//images.example/art.png', '/fixture/art.png',
    'data:image/png;base64,abc', 'blob:https://example.test/id', 'javascript:alert(1)',
    'file:///tmp/art.png', 'filesystem:https://example.test/art.png', 'chrome-extension://id/art.png',
    'https://user:pass@images.example/art.png', ' https://images.example/art.png',
    'https://images.example/art.png\n', 'https://', `ipfs://${CID}/../art.png`,
    'ipfs://not-a-cid/art.png', `ipfs://${CID}?gateway=evil`
  ]) assert.equal(parsePublishedAssetUrl(value), null, value);
});

test('IPFS projection refuses a non-HTTPS or credential-bearing gateway', () => {
  assert.equal(resolvePublishedAssetUrl(`ipfs://${CID}`, { ipfsGateway: 'http://gateway.example/ipfs/' }), null);
  assert.equal(resolvePublishedAssetUrl(`ipfs://${CID}`, { ipfsGateway: 'https://user@gateway.example/ipfs/' }), null);
});
