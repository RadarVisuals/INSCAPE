import assert from 'node:assert/strict'; import test from 'node:test'; import { createLuksoActivityRepository } from './luksoActivityRepository.js';
const PROFILE = '0xf3c189819fd5b042f692983bfbfd57ab607ee709'; const OTHER = '0x1234567890abcdef1234567890abcdef12345678'; const ASSET = '0x1111111111111111111111111111111111111111';

test('repository retains normalized signals when GraphQL reports a partial metadata failure', async () => {
  const repository = createLuksoActivityRepository({ fetchImpl: async () => ({ ok: true, json: async () => ({ errors: [{ message: 'metadata timeout' }], data: {
    Transfer: [{ id: 'transfer', transaction_id: '0xabc', from_id: OTHER, to_id: PROFILE, timestamp: 10, asset_id: ASSET, value: '1', asset: { id: ASSET, name: 'Token', isLSP7: true } }],
    Transfer_aggregate: { aggregate: { count: 1 } }, Transaction: [], Transaction_aggregate: { aggregate: { count: 0 } }
  } }) }) });
  const result = await repository.loadRecentActivity(PROFILE); assert.equal(result.signals.length, 1); assert.equal(result.signals[0].type, 'ASSET_RECEIVED'); assert.match(result.partialError, /metadata timeout/);
});
