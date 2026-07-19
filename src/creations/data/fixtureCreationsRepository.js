import { normalizeProfileAddress } from '../../library/config.js';

export function createFixtureCreationsRepository({ fetchImpl = globalThis.fetch, fixtureUrl = '/fixtures/profile-creations.v1.json' } = {}) {
  return {
    source: 'FIXTURE',
    async *loadCreations(viewedProfileAddress, { signal } = {}) {
      const profile = normalizeProfileAddress(viewedProfileAddress);
      if (!profile) throw new TypeError('A valid viewed Universal Profile address is required');
      const response = await fetchImpl(fixtureUrl, { signal });
      if (!response.ok) throw new Error(`Fixture responded ${response.status}`);
      const payload = await response.json();
      const assets = (Array.isArray(payload.assets) ? payload.assets : [])
        .filter((asset) => (asset.creators || []).some((creator) => normalizeProfileAddress(creator.address) === profile))
        .map((asset) => ({ ...asset, viewedProfileIsCreator: true }));
      yield { assets, resolved: assets.length, total: assets.length, failures: assets.filter((asset) => !asset.imageUrl).length, complete: true };
    }
  };
}

export const fixtureCreationsRepository = createFixtureCreationsRepository();
