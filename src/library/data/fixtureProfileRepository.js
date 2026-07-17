import { normalizeProfileAddress } from '../config.js';

export function createFixtureProfileRepository({ fetchImpl = globalThis.fetch, fixtureUrl = '/fixtures/profile-library.v1.json' } = {}) {
  return {
    source: 'FIXTURE',
    async *loadProfileAssets(profileAddress, { signal } = {}) {
      const profile = normalizeProfileAddress(profileAddress);
      const response = await fetchImpl(fixtureUrl, { signal });
      if (!response.ok) throw new Error(`Fixture responded ${response.status}`);
      const payload = await response.json();
      const assets = (Array.isArray(payload.assets) ? payload.assets : []).map((asset) => ({ ...asset, ownerAddress: profile }));
      yield { assets, resolved: assets.length, total: assets.length,
        failures: assets.filter((asset) => !asset.imageUrl).length, complete: true };
    }
  };
}

export const fixtureProfileRepository = createFixtureProfileRepository();
