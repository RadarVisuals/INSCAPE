import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { keccak256, toBytes } from 'viem';
import { encodeDataSourceWithHash } from '@erc725/erc725.js';
import { parseKeeperDialogue } from './keeperDialogue.js';
import { loadKeeperDialogue } from './loadKeeperDialogue.js';
import { createLsp8CollectionMetadataResolver } from '../library/data/lsp8TokenMetadataResolver.js';

const dialogue = JSON.parse(await readFile(new URL('../../browser-tests/fixtures/keeper-dialogue.v1.txt', import.meta.url), 'utf8'));
const asset = { chainId: 42, tokenStandard: 'LSP8', contractAddress: `0x${'1'.repeat(40)}`, tokenId: `0x${'0'.repeat(63)}4` };
const hash = value => ({ method: 'keccak256(bytes)', data: keccak256(toBytes(value)) });
const attachment = { url: 'ipfs://dialogue/keeper-dialogue.v1.txt', fileType: 'text/plain', verification: hash(JSON.stringify(dialogue)) };
const resolver = { resolveAttachments: async () => [attachment] };

test('plays all 164 uploaded passages and validates every reply target', () => {
  assert.equal(Object.keys(parseKeeperDialogue(dialogue).nodes).length, 164);
  for (const mutate of [
    d => d.version = 2,
    d => d.nodes.hello.choices[0].next = 'missing',
    d => d.nodes.hello.html = '<script/>',
    d => d.nodes.hello.choices[0].action = 'navigate',
    d => d.nodes.hello.text = 'a'.repeat(2001),
    d => d.start = '__proto__',
  ]) { const bad = structuredClone(dialogue); mutate(bad); assert.throws(() => parseKeeperDialogue(bad)); }
});

test('discovers plain-text JSON from the asset identity, verifies it and distinguishes missing from failed', async () => {
  assert.deepEqual(await loadKeeperDialogue(asset, { resolver, fetchImpl: async () => new Response(JSON.stringify(dialogue)) }), dialogue);
  assert.equal(await loadKeeperDialogue(asset, { resolver: { resolveAttachments: async () => [] } }), null);
  await assert.rejects(loadKeeperDialogue(asset, { resolver, fetchImpl: async () => Response.json({ ...dialogue, start: 'about' }) }), { code: 'METADATA_HASH_MISMATCH' });
  await assert.rejects(loadKeeperDialogue(asset, { resolver: { resolveAttachments: async () => { throw Error('offline'); } } }), /offline/);
  await assert.rejects(loadKeeperDialogue(asset, { resolver, fetchImpl: async () => new Response('x'.repeat(300000)) }), { code: 'METADATA_TOO_LARGE' });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(loadKeeperDialogue(asset, { resolver, signal: controller.signal }), { name: 'AbortError' });
});

test('ignores ordinary prose and unrelated JSON but reports malformed named dialogue', async () => {
  const file = { url: 'ipfs://test/readme.txt', fileType: 'text/plain' };
  for (const body of ['Just a description.', '{"description":"artwork"}']) {
    assert.equal(await loadKeeperDialogue(asset, { resolver: { resolveAttachments: async () => [file] }, fetchImpl: async () => new Response(body) }), null);
  }
  await assert.rejects(loadKeeperDialogue(asset, { resolver: { resolveAttachments: async () => [{ ...file, url: attachment.url }] }, fetchImpl: async () => new Response('broken JSON') }));
});

test('attachment reads use the existing token lookup and authenticate metadata before exposing files', async () => {
  const body = JSON.stringify({ LSP4Metadata: { name: 'Keeper', assets: [attachment] } });
  const pointer = encodeDataSourceWithHash(hash(body), 'ipfs://metadata');
  let tamper = false, fail = false;
  const rpc = createLsp8CollectionMetadataResolver({
    client: { readContract: async ({ functionName, args }) => {
      if (fail) throw Error('offline');
      if (functionName === 'getDataForTokenId') { assert.equal(args[0], asset.tokenId); return pointer; }
      return '0x';
    } },
    fetchImpl: async () => new Response(tamper ? body.replace('Keeper', 'Other') : body),
  });
  assert.deepEqual(await rpc.resolveAttachments(asset.contractAddress, asset.tokenId), [attachment]);
  tamper = true;
  await assert.rejects(rpc.resolveAttachments(asset.contractAddress, asset.tokenId), { code: 'METADATA_HASH_MISMATCH' });
  fail = true;
  await assert.rejects(rpc.resolveAttachments(asset.contractAddress, asset.tokenId), /could not be read/);
});
