import test from 'node:test';
import assert from 'node:assert/strict';
import { keeperMetadataReference, keeperMetadataResult } from './keeperMetadata.js';
import { loadKeeperMetadata } from './loadKeeperMetadata.js';
import { captureKeeperScene } from './keeperScene.js';

const id = `42:0x${'a'.repeat(40)}:0x${'0'.repeat(63)}4`;
const ref = keeperMetadataReference(id, 'LSP8');
const source = 'LSP4MetadataForTokenId (DIRECT LUKSO RPC)';

test('metadata requires a known LUKSO LSP8 bytes32 identity, and bounds only permitted fields', () => {
  assert.equal(keeperMetadataReference(id, 'LSP7'), null);
  assert.equal(keeperMetadataReference(id.replace('42:', '1:'), 'LSP8'), null);
  assert.equal(keeperMetadataReference('https://example.test', 'LSP8'), null);
  assert.equal(keeperMetadataReference(id.replace(/0{63}4$/, '04'), 'LSP8'), null);
  const result = keeperMetadataResult({ ...ref, status: 'available', source, readAt: 1,
    description: 'a'.repeat(5000), attributes: Array.from({ length: 40 }, () => ({ key: 'eyes', value: 4 })),
    private: 'secret', owner: 'someone', creators: ['invented'], url: 'http://localhost' }, ref);
  assert.equal(result.description.length, 4000); assert.equal(result.attributes.length, 32);
  assert.equal(result.attributes[0].value, '4'); assert.equal(result.truncated, true);
  for (const key of ['private', 'owner', 'creators', 'url']) assert.equal(result[key], undefined);
  assert.throws(() => keeperMetadataResult({ ...result, stableAssetId: 'other' }, ref), /match/);
});

test('metadata reuses strict token resolver, separates missing/failed and discards cancelled reads', async () => {
  const resolver = { async resolve(contract, tokens, options) {
    assert.equal(contract, ref.contractAddress); assert.equal(tokens[0].tokenId, ref.tokenId); assert.equal(options.strict, true);
    return new Map([[ref.tokenId, { metadataResolved: true, metadataSource: source, name: 'Four eyes',
      attributes: [{ key: 'Eyes', value: 4, attributeType: 'number' }] }]]);
  } };
  const result = await loadKeeperMetadata(ref, { resolver });
  assert.equal(result.name, 'Four eyes'); assert.equal(result.attributes[0].type, 'number');
  assert.equal((await loadKeeperMetadata(ref, { resolver: { resolve: async () => new Map() } })).status, 'unavailable');
  assert.equal((await loadKeeperMetadata(ref, { resolver: { resolve: async () => { throw Error('Hash mismatch'); } } })).status, 'failed');
  const controller = new AbortController(); let finish;
  const pending = loadKeeperMetadata(ref, { signal: controller.signal, resolver: { resolve: () => new Promise(resolve => { finish = resolve; }) } });
  controller.abort(); await assert.rejects(pending, { name: 'AbortError' }); finish(new Map());
});

test('scene only offers metadata for shared visible artwork and invalidates changed identity', async () => {
  const node = { dataset: { artworkContextId: 'module:one', artworkContextTitle: 'Artwork', artworkContextAsset: id, artworkContextStandard: 'LSP8' },
    checkVisibility: () => true, getBoundingClientRect: () => ({ left: 10, top: 10, right: 100, bottom: 100 }) };
  const host = { isConnected: true, contains: candidate => candidate === node, querySelectorAll: () => [node],
    ownerDocument: { defaultView: { innerWidth: 800, innerHeight: 800 } } };
  node.parentElement = host;
  const origin = { x: 200, y: 200 };
  assert.equal(captureKeeperScene(host, origin, null, { shareArtwork: false }).scene.artworks.length, 0);
  const snapshot = captureKeeperScene(host, origin, null, { shareArtwork: true });
  assert.equal(snapshot.scene.artworks[0].metadata.stableAssetId, id);
  node.dataset.artworkContextAsset = 'changed';
  assert.equal((await snapshot.metadata(['art-1']))[0].status, 'changed');
  await assert.rejects(snapshot.metadata(['art-2']), /unavailable/);
});
