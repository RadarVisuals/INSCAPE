import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeDataSourceWithHash } from '@erc725/erc725.js';
import { keccak256 } from 'viem';
import { buildProfileDocumentV9Asset } from './profileDocumentV9Asset.js';
import { resolveProfileDocumentV9ContentReference } from './profileDocumentV9ContentReferenceResolver.js';

const CONTRACT = '0x3983151e0442906000dab83c8b1cf3f2d2535f82';
const TOKEN_ID = '0x00000000000000000000000085bc3f6772107468dd9edf194f114b0c8c66eb71';
const ID = `42:${CONTRACT}:${TOKEN_ID}`;
const DATA_KEY = '0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e';
const bytes = (value) => new TextEncoder().encode(value);

function fixture() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>';
  const svgUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const document = { LSP4Metadata: { name: 'Burnt Pix', images: [[{
    url: svgUrl, width: 768, height: 768, verification: {
      method: 'keccak256(bytes)', data: keccak256(bytes(svg)),
    },
  }]] } };
  const json = JSON.stringify(document);
  const metadataUrl = `data:application/json;charset=UTF-8,${encodeURIComponent(json)}`;
  const verification = { method: 'keccak256(utf8)', data: keccak256(bytes(json)) };
  const encoded = encodeDataSourceWithHash(verification, metadataUrl);
  const asset = buildProfileDocumentV9Asset({
    id: ID, chainId: 42, contractAddress: CONTRACT, tokenId: TOKEN_ID, standard: 'LSP8',
    name: 'Burnt Pix', description: '', imageUrl: svgUrl, imageWidth: 150, imageHeight: 150,
    creators: [], attributes: [], contentReference: {
      protocol: 'erc725y', scope: 'tokenId', dataKey: DATA_KEY, verification,
    },
  }, ID);
  return { asset, encoded, svgUrl };
}

test('compact v9 content reference resolves direct LSP4 metadata and verifies its nested SVG', async () => {
  const { asset, encoded, svgUrl } = fixture();
  const calls = [];
  const resolved = await resolveProfileDocumentV9ContentReference(asset, { client: {
    readContract: async (request) => { calls.push(request); return encoded; },
  } });
  assert.equal(resolved.src, svgUrl);
  assert.deepEqual({ width: resolved.width, height: resolved.height }, { width: 768, height: 768 });
  assert.deepEqual(calls[0].args, [TOKEN_ID, DATA_KEY]);
});

test('compact v9 content reference fails closed on changed metadata or nested media', async () => {
  const { asset, encoded } = fixture();
  const wrongReference = structuredClone(asset);
  wrongReference.media.reference.verification.data = `0x${'11'.repeat(32)}`;
  assert.equal(await resolveProfileDocumentV9ContentReference(wrongReference,
    { client: { readContract: async () => encoded } }), null);

  const broken = encodeDataSourceWithHash(asset.media.reference.verification,
    'data:application/json;charset=UTF-8,%7B%22LSP4Metadata%22%3A%7B%7D%7D');
  assert.equal(await resolveProfileDocumentV9ContentReference(asset,
    { client: { readContract: async () => broken } }), null);
});
