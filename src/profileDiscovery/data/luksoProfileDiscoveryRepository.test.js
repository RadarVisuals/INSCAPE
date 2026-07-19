import test from 'node:test';
import assert from 'node:assert/strict';
import { createLuksoProfileDiscoveryRepository, PROFILE_DISCOVERY_QUERY } from './luksoProfileDiscoveryRepository.js';

const PROFILE = '0x1111111111111111111111111111111111111111';

test('uses the documented search_profiles schema and normalizes indexer results', async () => {
  let request;
  const repository = createLuksoProfileDiscoveryRepository({
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return { ok: true, json: async () => ({ data: { search_profiles: [{ id: PROFILE, name: 'Alice', fullName: null, profileImages: [] }] } }) };
    }
  });
  const results = await repository.search('alice');
  assert.match(PROFILE_DISCOVERY_QUERY, /search_profiles\(args: \{ search: \$search \}\)/);
  assert.deepEqual(request.variables, { search: 'alice' });
  assert.equal(results[0].address, PROFILE);
  assert.equal(results[0].source, 'LUKSO Envio Indexer');
});

test('exact addresses resolve directly without relying on name discovery', async () => {
  let fetchCalls = 0;
  const repository = createLuksoProfileDiscoveryRepository({
    fetchImpl: async () => { fetchCalls += 1; throw new Error('Indexer should not be called'); },
    exactRepository: { resolve: async (address) => ({ address, name: 'Exact', avatarUrl: null, isUniversalProfile: true, status: 'RESOLVED' }) }
  });
  const [result] = await repository.search(PROFILE.toUpperCase().replace('0X', '0x'));
  assert.equal(fetchCalls, 0);
  assert.equal(result.address, PROFILE);
  assert.equal(result.source, 'LUKSO RPC + LSP3');
});

test('passes abort signals to remote name searches', async () => {
  const controller = new AbortController();
  const repository = createLuksoProfileDiscoveryRepository({
    fetchImpl: async (_url, options) => {
      assert.equal(options.signal, controller.signal);
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }
  });
  controller.abort();
  await assert.rejects(repository.search('alice', { signal: controller.signal }), { name: 'AbortError' });
});

test('exact address network failures expose the retryable error path', async () => {
  const repository = createLuksoProfileDiscoveryRepository({
    exactRepository: { resolve: async (address) => ({ address, isUniversalProfile: false, status: 'ERROR' }) }
  });
  await assert.rejects(repository.search(PROFILE), /verification is unavailable/);
});
