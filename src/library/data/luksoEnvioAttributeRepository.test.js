import assert from 'node:assert/strict';
import test from 'node:test';
import { createLuksoEnvioAttributeRepository } from './luksoEnvioAttributeRepository.js';

const contract = '0xed9e87f7858ca952a242c9016d78dab328d6c23b';
const tokenId = `0x${'0'.repeat(62)}f6`;

test('reads every official Envio token attribute including numeric Rank', async () => {
  let request;
  const repository = createLuksoEnvioAttributeRepository({ endpoint: 'https://envio.example/graphql',
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return { ok: true, json: async () => ({ data: { Token: [{ id: `${contract}-${tokenId}`,
        attributes: [
          { key: 'Performance Tier', value: 'Strike Unit', attributeType: 'string' },
          { key: 'Rank', value: '281', attributeType: 'number' }
        ] }] } }) };
    } });
  const stableAssetId = `42:${contract}:${tokenId}`;
  const result = await repository.enrich([stableAssetId, stableAssetId, `42:${contract}:contract`]);
  assert.deepEqual(request.variables.ids, [`${contract}-${tokenId}`]);
  assert.deepEqual(result, [{ id: stableAssetId, attributes: [
    { key: 'Performance Tier', value: 'Strike Unit', type: 'string' },
    { key: 'Rank', value: '281', type: 'number' }
  ] }]);
});

test('does not request Envio when there are no valid LSP8 stable IDs', async () => {
  const repository = createLuksoEnvioAttributeRepository({ fetchImpl: async () => { throw new Error('unexpected request'); } });
  assert.deepEqual(await repository.enrich(['invalid', `42:${contract}:contract`]), []);
});
