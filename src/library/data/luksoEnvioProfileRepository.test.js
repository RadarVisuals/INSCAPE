import assert from 'node:assert/strict';
import test from 'node:test';
import { createLuksoEnvioProfileRepository } from './luksoEnvioProfileRepository.js';

const profile = '0xf3c189819fd5b042f692983bfbfd57ab607ee709';
const collection = '0x2222222222222222222222222222222222222222';
const lsp7 = '0x1111111111111111111111111111111111111111';
const tokenId = n => '0x' + n.toString(16).padStart(64, '0');
const assetId = n => `42:${collection}:${tokenId(n)}`;
const creator = { profile_id: profile, profile: { name: 'Artist' } };
function holding(n, metadata = {}) {
  return { id: `hold-${n}`, profile_id: profile, balance: '1', baseAsset_id: collection,
    asset_id: null, token_id: `${collection}-${tokenId(n)}`,
    baseAsset: { id: collection, name: 'Collection', lsp4TokenType: 2, isCollection: true,
      lsp4Creators: [creator], images: [{ index: 0, url: 'https://art.test/collection.webp', width: 640 }] },
    token: { tokenId: tokenId(n), baseAsset_id: collection, name: `Artwork ${n}`, description: 'Token artwork',
      images: [{ index: 0, url: `https://art.test/${n}.webp`, width: 1200 }], ...metadata },
  };
}
const response = (rows, total = rows.length) => ({ ok: true,
  json: async () => ({ data: { Hold: rows, Hold_aggregate: { aggregate: { count: total } } } }),
});
async function collect(repository, options) {
  const batches = [];
  for await (const batch of repository.loadProfileAssets(profile, options)) batches.push(batch);
  return batches;
}

test('loads LSP7 holdings and individual LSP8 tokens with source identity and creator attribution', async () => {
  const requests = [];
  const nft = holding(1, { attributes: [{ key: 'Eyes', value: 'Many', attributeType: 'string' }] });
  const fungible = { id: 'hold-lsp7', profile_id: profile, balance: '2', asset_id: lsp7, token_id: null,
    asset: { id: lsp7, name: 'Signal', isLSP7: true, lsp4TokenType: 1, description: 'Edition',
      images: [{ index: 0, url: 'ipfs://QmSignal/original.webp', src: 'https://proxy.test/thumb.webp', width: 2000 }],
      lsp4Creators: [creator] },
  };
  const repository = createLuksoEnvioProfileRepository({ ipfsGateway: 'https://gateway.test/ipfs/', fetchImpl: async (_, options) => {
    requests.push(JSON.parse(options.body)); return response([fungible, nft]);
  } });
  const [batch] = await collect(repository);
  assert.equal(batch.complete, true);
  assert.equal(batch.total, 2);
  assert.equal(batch.failures, 0);
  assert.equal(requests[0].variables.profile, profile);
  assert.equal(batch.assets[0].standard, 'LSP7');
  assert.equal(batch.assets[0].tokenType, 'NFT');
  assert.equal(batch.assets[0].imageUrl, 'https://gateway.test/ipfs/QmSignal/original.webp');
  assert.equal(batch.assets[1].id, assetId(1));
  assert.equal(batch.assets[1].standard, 'LSP8');
  assert.equal(batch.assets[1].collectionName, 'Collection');
  assert.deepEqual(batch.assets[1].creators, [{ address: profile, name: 'Artist' }]);
  assert.equal(batch.assets[1].fieldProvenance.creators.scope, 'contract');
  assert.deepEqual(batch.assets[1].attributes, [{ key: 'Eyes', value: 'Many', type: 'string' }]);
});

test('keeps all eleven attachments beside one cover with multiple resolutions and repeated filename prefixes', async () => {
  const attachments = Array.from({ length: 11 }, (_, i) => ({ url: `https://art.test/folder-${i}/images-0-art.webp`, fileType: 'image/webp' }));
  const repository = createLuksoEnvioProfileRepository({ fetchImpl: async () => response([holding(1, {
    images: [{ index: 0, url: 'https://art.test/cover-320.webp', width: 320 },
      { index: 0, url: 'https://art.test/cover-1800.webp', width: 1800 }],
    assets: [...attachments, { url: 'https://art.test/dialogue.txt', fileType: 'text/plain' }],
  })]) });
  const [batch] = await collect(repository); const asset = batch.assets[0];
  assert.equal(asset.imageGroups.length, 12);
  assert.equal(asset.imageGroups[0].variants.length, 2);
  assert.equal(asset.thumbnailUrl, 'https://art.test/cover-320.webp');
  assert.equal(asset.imageUrl, 'https://art.test/cover-1800.webp');
  assert.deepEqual(asset.imageGroups.slice(1).map(group => group.imageUrl), attachments.map(file => file.url));
});

test('pages only when requested, with bounded offsets and counts of holdings rather than collection wrappers', async () => {
  const offsets = [];
  const repository = createLuksoEnvioProfileRepository({ pageSize: 2, fetchImpl: async (_, options) => {
    const { offset, limit } = JSON.parse(options.body).variables; offsets.push(offset);
    return response([holding(1), holding(2), holding(3)].slice(offset, offset + limit), 3);
  } });
  const iterator = repository.loadProfileAssets(profile);
  assert.equal((await iterator.next()).value.complete, false);
  assert.deepEqual(offsets, [0]);
  const second = (await iterator.next()).value;
  assert.equal(second.complete, true); assert.equal(second.resolved, 3);
  assert.deepEqual(second.assets.map(asset => asset.id), [assetId(3)]);
  assert.equal((await iterator.next()).done, true);
  assert.deepEqual(offsets, [0, 2]);
});

test('targeted category reads retain owner filtering and expose missing references for direct RPC recovery', async () => {
  let variables;
  const repository = createLuksoEnvioProfileRepository({ fetchImpl: async (_, options) => {
    variables = JSON.parse(options.body).variables; return response([holding(1)]);
  } });
  const contractId = `42:${lsp7}:contract`;
  const [batch] = await collect(repository, { requestedAssetIds: [assetId(1), assetId(2), contractId] });
  assert.equal(variables.profile, profile);
  assert.deepEqual(variables.filter._or, [
    { token_id: { _eq: `${collection}-${tokenId(1)}` } },
    { token_id: { _eq: `${collection}-${tokenId(2)}` } },
    { asset_id: { _eq: lsp7 }, token_id: { _is_null: true } },
  ]);
  assert.deepEqual(batch.unresolvedAssetIds, [assetId(2), contractId]);
  assert.equal(batch.failures, 2);
  assert.equal(batch.complete, true);
});

test('missing or errored metadata remains recoverable, while valid global metadata can supply a cover', async () => {
  const missing = holding(1); missing.token = null;
  const repository = createLuksoEnvioProfileRepository({ fetchImpl: async () => response([
    missing, holding(2, { images: [], assets: [], name: null, description: null }),
    holding(3, { error: 'Metadata fetch failed' }),
  ]) });
  const [batch] = await collect(repository);
  assert.equal(batch.assets.length, 3);
  assert.equal(batch.assets[1].imageUrl, 'https://art.test/collection.webp');
  assert.equal(batch.assets[1].fieldProvenance.images.scope, 'contract');
  assert.deepEqual(batch.unresolvedAssetIds, [assetId(1), assetId(3)]);
  assert.equal(batch.failures, 2);
});

test('empty inventory succeeds, but invalid GraphQL responses and foreign identities fail into caller fallback', async () => {
  const [empty] = await collect(createLuksoEnvioProfileRepository({ fetchImpl: async () => response([]) }));
  assert.deepEqual(empty, { assets: [], unresolvedAssetIds: [], resolved: 0, total: 0, failures: 0, complete: true });
  const wrongToken = holding(1); wrongToken.token.tokenId = tokenId(2);
  const cases = [
    { ok: false, status: 503 },
    { ok: true, json: async () => ({ errors: [{ message: 'Schema unavailable' }] }) },
    { ok: true, json: async () => ({ data: {} }) },
    response([], 2), response([holding(1)], 0),
    response([{ ...holding(1), profile_id: lsp7 }]),
    response([{ ...holding(1), balance: '0' }]), response([wrongToken]),
    response([{ ...holding(1), baseAsset: { id: lsp7 } }]),
  ];
  for (const result of cases) await assert.rejects(collect(createLuksoEnvioProfileRepository({ fetchImpl: async () => result })));
});

test('duplicate pages and unrequested references cannot be reported as complete', async () => {
  const repository = createLuksoEnvioProfileRepository({ pageSize: 1, fetchImpl: async () => response([holding(1)], 2) });
  const iterator = repository.loadProfileAssets(profile);
  assert.equal((await iterator.next()).value.complete, false);
  await assert.rejects(iterator.next(), /duplicate or unexpected/);
  await assert.rejects(collect(createLuksoEnvioProfileRepository({ fetchImpl: async () => response([holding(2)]) }),
    { requestedAssetIds: [assetId(1)] }), /unexpected/);
});

test('abort suppresses a late page and invalid or empty requested IDs never initiate a fetch', async () => {
  const controller = new AbortController();
  const repository = createLuksoEnvioProfileRepository({ fetchImpl: async () => {
    controller.abort(); return response([holding(1)]);
  } });
  await assert.rejects(collect(repository, { signal: controller.signal }), { name: 'AbortError' });
  const noFetch = createLuksoEnvioProfileRepository({ fetchImpl: async () => { assert.fail('Unexpected request'); } });
  assert.equal((await collect(noFetch, { requestedAssetIds: [] }))[0].complete, true);
  await assert.rejects(collect(noFetch, { requestedAssetIds: [`1:${collection}:${tokenId(1)}`] }), /Invalid LUKSO asset ID/);
});
