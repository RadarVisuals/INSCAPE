import { LUKSO_INDEXER_URL, normalizeProfileAddress } from '../../library/config.js';
import { lsp3ProfileIdentityRepository } from '../../profileIdentity/data/lsp3ProfileIdentityRepository.js';
import { selectProfileAvatar } from '../../profileIdentity/domain/profileIdentity.js';

// Documented by LUKSO: https://docs.lukso.tech/tools/apis/indexer-api/
export const PROFILE_DISCOVERY_QUERY = `query SearchProfiles($search: String!) {
  search_profiles(args: { search: $search }) {
    id
    name
    fullName
    profileImages(where: { error: { _is_null: true } } order_by: { width: asc }) {
      width
      src
      url
      verified
    }
  }
}`;

const clean = (value, limit = 80) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, limit)
  : '';

function normalizeIndexerProfile(profile) {
  const address = normalizeProfileAddress(profile?.id);
  if (!address) return null;
  return { address, name: clean(profile.name) || clean(profile.fullName) || null,
    avatarUrl: selectProfileAvatar(profile.profileImages), isUniversalProfile: true,
    status: 'INDEXED', source: 'LUKSO Envio Indexer' };
}

export function createLuksoProfileDiscoveryRepository({ endpoint = LUKSO_INDEXER_URL, fetchImpl = globalThis.fetch,
  exactRepository = lsp3ProfileIdentityRepository } = {}) {
  return { source: 'LUKSO Envio Indexer', async search(rawQuery, { signal } = {}) {
    const query = clean(rawQuery, 120); if (!query) return [];
    const exactAddress = normalizeProfileAddress(query);
    if (exactAddress) {
      const identity = await exactRepository.resolve(exactAddress, { signal });
      if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
      if (identity.status === 'ERROR') throw new Error('Direct LUKSO profile verification is unavailable');
      return [{ address: exactAddress, name: identity.name, avatarUrl: identity.avatarUrl,
        isUniversalProfile: identity.isUniversalProfile, status: identity.status, errorCode: identity.errorCode,
        source: identity.isUniversalProfile ? 'LUKSO RPC + LSP3' : 'LUKSO RPC' }];
    }
    const response = await fetchImpl(endpoint, { method: 'POST', signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: PROFILE_DISCOVERY_QUERY, variables: { search: query } }) });
    if (!response.ok) throw new Error(`LUKSO indexer responded ${response.status}`);
    const payload = await response.json();
    if (payload.errors?.length) throw new Error(payload.errors[0]?.message || 'Profile discovery failed');
    if (!Array.isArray(payload.data?.search_profiles)) throw new Error('Invalid LUKSO indexer response');
    return payload.data.search_profiles.map(normalizeIndexerProfile).filter(Boolean).slice(0, 24);
  } };
}

export const luksoProfileDiscoveryRepository = createLuksoProfileDiscoveryRepository();
