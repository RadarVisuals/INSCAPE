import test from 'node:test';
import assert from 'node:assert/strict';
import { createLuksoCreationsRepository, CREATIONS_QUERY } from './luksoCreationsRepository.js';

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
  const repository = createLuksoCreationsRepository({ fetchImpl, pageSize: 1 });
  const batches = [];
  for await (const batch of repository.loadCreations(PROFILE)) batches.push(batch);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.assetOffset), [0, 1]);
  assert.equal(batches.at(-1).complete, true);
  assert.equal(batches.flatMap((batch) => batch.assets).every((asset) => !asset.isOwnedByViewedProfile), true);
});
