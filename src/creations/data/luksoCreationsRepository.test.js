import test from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTION_TOKENS_QUERY, createLuksoCreationsRepository, CREATIONS_QUERY,
  REFERENCED_CREATIONS_QUERY } from './luksoCreationsRepository.js';
import { collectionTokenNeedsMetadataRefresh } from './lsp8CollectionMetadataResolver.js';

const PROFILE = '0x1234567890abcdef1234567890abcdef12345678';
const CONTRACT_A = '0x1111111111111111111111111111111111111111';
const CONTRACT_B = '0x2222222222222222222222222222222222222222';

function row(id, contract = CONTRACT_A) {
  return { id, profile_id: PROFILE, asset_id: contract, asset: { id: contract, isLSP7: true, name: id,
    description: 'Creator-attributed', images: [], holders: [], lsp4Creators: [{ profile_id: PROFILE }], attributes: [] } };
}

test('query uses creator relationships and never Hold as its data source', () => {
  assert.match(CREATIONS_QUERY, /AssetCreators/);
  assert.match(CREATIONS_QUERY, /TokenCreators/);
  assert.doesNotMatch(CREATIONS_QUERY, /\bHold\s*\(/);
  assert.match(CREATIONS_QUERY, /profile_id:\s*\{ _eq: \$profile \}/);
  assert.match(CREATIONS_QUERY, /images[\s\S]*\{ index src url width height/);
  assert.match(CREATIONS_QUERY, /tokens\(limit: 1, order_by: \{ id: asc \}\) \{ tokenId \}/);
  assert.match(CREATIONS_QUERY, /TokenCreators[\s\S]*token \{[\s\S]*holders \{ id profile_id balance \}/);
});

test('paginates asset and token creator paths independently and includes unowned creations', async () => {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const { variables } = JSON.parse(options.body); calls.push(variables);
    const first = variables.assetOffset === 0;
    return { ok: true, json: async () => ({ data: {
      AssetCreators: first ? [row('one')] : [row('two', CONTRACT_B)],
      AssetCreators_aggregate: { aggregate: { count: 2 } },
      TokenCreators: [], TokenCreators_aggregate: { aggregate: { count: 0 } }
    } }) };
  };
  const repository = createLuksoCreationsRepository({ fetchImpl, pageSize: 1, collectionMetadataResolver: null });
  const batches = [];
  for await (const batch of repository.loadCreations(PROFILE)) batches.push(batch);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.assetOffset), [0, 1]);
  assert.equal(batches.at(-1).complete, true);
  assert.equal(batches.flatMap((batch) => batch.assets).every((asset) => !asset.isOwnedByViewedProfile), true);
});

test('resolves only curated creator references without enumerating the full creations or collection lists', async () => {
  const tokenId = `0x${'0'.repeat(63)}1`;
  const calls = [];
  const collection = { id: CONTRACT_B, isLSP7: false, isCollection: true, name: 'Collection',
    description: 'Creator collection', images: [{ src: 'https://assets.example/cover.webp' }],
    holders: [], lsp4Creators: [{ profile_id: PROFILE }], attributes: [], tokens: [{ tokenId }] };
  const token = { id: 'token', tokenId, name: 'Curated token', description: 'Exact token',
    images: [{ src: 'https://assets.example/token.webp' }], attributes: [], lsp4Creators: [], holders: [],
    baseAsset: collection };
  const repository = createLuksoCreationsRepository({ collectionMetadataResolver: null,
    fetchImpl: async (_url, options) => {
      calls.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ data: {
        AssetCreators: [row('curated-contract'), { id: 'collection-creator', profile_id: PROFILE,
          asset_id: CONTRACT_B, asset: collection }],
        TokenCreators: [], Token: [token],
      } }) };
    } });
  const requested = [`42:${CONTRACT_A}:contract`, `42:${CONTRACT_B}:${tokenId}`];
  const batches = [];
  for await (const batch of repository.loadReferencedCreations(PROFILE, requested)) batches.push(batch);

  assert.equal(calls.length, 1);
  assert.match(calls[0].query, /query ReferencedCreations/);
  assert.deepEqual(calls[0].variables, { profile: PROFILE, contracts: [CONTRACT_A, CONTRACT_B], tokenIds: [tokenId] });
  assert.deepEqual(batches[0].assets.map(({ id }) => id), requested);
  assert.equal(batches[0].complete, true);
});

test('referenced creations query remains relationship-scoped and exact-token bounded', () => {
  assert.match(REFERENCED_CREATIONS_QUERY, /AssetCreators\(where:[\s\S]*profile_id:[\s\S]*asset_id: \{ _in: \$contracts \}/);
  assert.match(REFERENCED_CREATIONS_QUERY, /TokenCreators\(where:[\s\S]*tokenId: \{ _in: \$tokenIds \}/);
  assert.match(REFERENCED_CREATIONS_QUERY, /Token\(where:[\s\S]*tokenId: \{ _in: \$tokenIds \}/);
  assert.doesNotMatch(REFERENCED_CREATIONS_QUERY, /Token_aggregate|AssetCreators_aggregate|TokenCreators_aggregate/);
});

test('paginates every token in an accepted creator collection by exact contract', async () => {
  const calls = [];
  const collectionRecord = {
    contractAddress: CONTRACT_A, isCollection: true, viewedProfileIsCreator: true, creatorAttributionLevel: 'contract',
    creators: [{ address: PROFILE }],
  };
  const token = (tokenId, holder) => ({
    id: `${CONTRACT_A}-${tokenId}`, tokenId, name: `HALO ${tokenId}`, images: [], attributes: [], lsp4Creators: [],
    holders: [{ profile_id: holder, balance: '1' }], asset: { id: CONTRACT_A, isCollection: true, name: 'HALO' },
  });
  const fetchImpl = async (_url, options) => {
    const { query, variables } = JSON.parse(options.body);
    calls.push({ query, variables });
    return { ok: true, json: async () => ({ data: {
      Token: variables.offset === 0 ? [token('0x01', PROFILE)] : [token('0x02', CONTRACT_B)],
      Token_aggregate: { aggregate: { count: 2 } },
    } }) };
  };
  const repository = createLuksoCreationsRepository({ fetchImpl, pageSize: 1, collectionMetadataResolver: null });
  const batches = [];
  for await (const batch of repository.loadCollectionTokens(PROFILE, collectionRecord)) batches.push(batch);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(({ variables }) => variables), [
    { contract: CONTRACT_A, limit: 1, offset: 0 }, { contract: CONTRACT_A, limit: 1, offset: 1 },
  ]);
  assert.equal(batches.at(-1).complete, true);
  assert.deepEqual(batches.flatMap(({ assets }) => assets).map(({ viewedProfileIsCollectionCreator }) => viewedProfileIsCollectionCreator), [true, true]);
  assert.equal(batches[1].assets[0].currentOwnerAddress, CONTRACT_B);
});

test('collection query supports current baseAsset and legacy asset token relations without using Hold discovery', () => {
  assert.match(COLLECTION_TOKENS_QUERY, /Token\(where:\s*\{ _or:\s*\[\{ asset_id:\s*\{ _eq: \$contract \} \}, \{ baseAsset_id:/);
  assert.match(COLLECTION_TOKENS_QUERY, /Token_aggregate\(where:\s*\{ _or:/);
  assert.match(COLLECTION_TOKENS_QUERY, /baseAsset \{[\s\S]*id name lsp4TokenName standard/);
  assert.doesNotMatch(COLLECTION_TOKENS_QUERY, /\bHold\s*\(/);
  assert.match(COLLECTION_TOKENS_QUERY, /holders \{ id profile_id balance \}/);
});

test('refreshes only missing or collection-cover token media and retains indexed holder facts', async () => {
  const cover = { url: 'ipfs://collection-cover', src: 'https://gateway.example/collection-cover' };
  const revealed = { url: 'ipfs://revealed-one', src: 'https://gateway.example/revealed-one' };
  const current = { url: 'ipfs://current-two', src: 'https://gateway.example/current-two' };
  const collectionRecord = {
    contractAddress: CONTRACT_A, isCollection: true, viewedProfileIsCreator: true, creatorAttributionLevel: 'contract',
    creators: [{ address: PROFILE }],
  };
  const staleToken = { id: 'stale', tokenId: `0x${'0'.repeat(63)}1`, name: 'HALO', description: '',
    images: [cover], attributes: [], lsp4Creators: [], holders: [{ profile_id: CONTRACT_B, balance: '1' }],
    baseAsset: { id: CONTRACT_A, isCollection: true, name: 'HALO', images: [cover] } };
  const currentToken = { ...staleToken, id: 'current', tokenId: `0x${'0'.repeat(63)}2`,
    name: 'HALO:0002', images: [current] };
  const resolverCalls = [];
  const collectionMetadataResolver = { async resolve(contract, tokens) {
    resolverCalls.push({ contract, tokens });
    return new Map([[staleToken.tokenId, { tokenId: staleToken.tokenId, name: 'HALO:0001', description: 'Revealed',
      images: [revealed], attributes: [{ key: 'Rank', value: 1, attributeType: 'number' }],
      metadataSource: 'LSP8TokenMetadataBaseURI (DIRECT LUKSO RPC)', metadataResolved: true }]]);
  } };
  const fetchImpl = async () => ({ ok: true, json: async () => ({ data: {
    Token: [staleToken, currentToken], Token_aggregate: { aggregate: { count: 2 } },
  } }) });
  const repository = createLuksoCreationsRepository({ fetchImpl, pageSize: 24, collectionMetadataResolver });
  const batches = [];
  for await (const batch of repository.loadCollectionTokens(PROFILE, collectionRecord)) batches.push(batch);
  assert.equal(resolverCalls.length, 1);
  assert.deepEqual(resolverCalls[0].tokens.map(({ tokenId }) => tokenId), [staleToken.tokenId]);
  assert.equal(batches[0].assets[0].name, 'HALO:0001');
  assert.equal(batches[0].assets[0].imageUrl, revealed.src);
  assert.equal(batches[0].assets[0].currentOwnerAddress, CONTRACT_B);
  assert.deepEqual(batches[0].assets[0].fieldProvenance.images,
    { scope: 'tokenId', source: 'LSP8TokenMetadataBaseURI (DIRECT LUKSO RPC)' });
  assert.equal(batches[0].assets[1].imageUrl, current.src);
});

test('classifies collection-cover and missing token media as refresh candidates', () => {
  const cover = { url: 'ipfs://cover' };
  assert.equal(collectionTokenNeedsMetadataRefresh({ tokenId: '0x01', images: [cover],
    baseAsset: { images: [cover] } }), true);
  assert.equal(collectionTokenNeedsMetadataRefresh({ tokenId: '0x01', images: [], baseAsset: { images: [cover] } }), true);
  assert.equal(collectionTokenNeedsMetadataRefresh({ tokenId: '0x01', images: [{ url: 'ipfs://token' }],
    baseAsset: { images: [cover] } }), false);
});

test('uses a directly resolved token preview to keep a coverless creator collection discoverable', async () => {
  const tokenId = `0x${'0'.repeat(63)}1`;
  const preview = { src: 'https://gateway.example/hivemind.webp', url: 'ipfs://hivemind.webp', width: 2000, height: 2000 };
  const collectionMetadataResolver = { async resolve(contract, tokens) {
    assert.equal(contract, CONTRACT_A); assert.equal(tokens[0].tokenId, tokenId);
    return new Map([[tokenId, { tokenId, name: 'Hivemind', description: 'Preview token', images: [preview], attributes: [],
      metadataSource: 'LSP8TokenMetadataBaseURI (DIRECT LUKSO RPC)', metadataResolved: true }]]);
  } };
  const fetchImpl = async () => ({ ok: true, json: async () => ({ data: {
    AssetCreators: [{ id: 'creeps', profile_id: PROFILE, asset_id: CONTRACT_A, asset: {
      id: CONTRACT_A, lsp4TokenName: 'CREEPS', isCollection: true, isLSP7: false,
      description: 'Creator collection', images: [], tokens: [{ tokenId }], holders: [], attributes: [],
      lsp4Creators: [{ profile_id: PROFILE }],
    } }], AssetCreators_aggregate: { aggregate: { count: 1 } },
    TokenCreators: [], TokenCreators_aggregate: { aggregate: { count: 0 } },
  } }) });
  const repository = createLuksoCreationsRepository({ fetchImpl, collectionMetadataResolver });
  const batches = [];
  for await (const batch of repository.loadCreations(PROFILE)) batches.push(batch);
  const collection = batches[0].assets[0];
  assert.equal(collection.name, 'CREEPS');
  assert.equal(collection.imageUrl, preview.src);
  assert.equal(collection.collectionPreviewTokenId, tokenId);
  assert.deepEqual(collection.fieldProvenance.images,
    { scope: 'collectionPreviewTokenId', source: 'LSP8TokenMetadataBaseURI (DIRECT LUKSO RPC)' });
});
