import { LIBRARY_PAGE_SIZE, LUKSO_INDEXER_URL, normalizeProfileAddress } from '../config.js';
import { normalizeProfileAsset } from '../domain/normalizeProfileAsset.js';

const LIBRARY_QUERY = `
query ProfileLibrary($profile: String!, $limit: Int!, $offset: Int!) {
  Hold(where: { profile_id: { _eq: $profile } }, limit: $limit, offset: $offset, order_by: { id: asc }) {
    id balance asset_id token_id
    asset {
      id name lsp4TokenName standard isLSP7 isCollection description error
      images(where: { error: { _is_null: true } }, order_by: { width: asc }) { src url width height fileType error }
      lsp4Creators { profile_id profile { name } }
      attributes { key value attributeType }
    }
    token {
      id tokenId formattedTokenId name lsp4TokenName description error
      images(where: { error: { _is_null: true } }, order_by: { width: asc }) { src url width height fileType error }
      lsp4Creators { profile_id profile { name } }
      attributes { key value attributeType }
      asset {
        id name lsp4TokenName standard isLSP7 isCollection description error
        images(where: { error: { _is_null: true } }, order_by: { width: asc }) { src url width height fileType error }
        lsp4Creators { profile_id profile { name } }
      }
    }
  }
  Hold_aggregate(where: { profile_id: { _eq: $profile } }) { aggregate { count } }
}`;

async function requestPage({ endpoint, fetchImpl, profileAddress, limit, offset, signal }) {
  const response = await fetchImpl(endpoint, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: LIBRARY_QUERY, variables: { profile: profileAddress, limit, offset } })
  });
  if (!response.ok) throw new Error(`LUKSO indexer responded ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors.map((entry) => entry.message).join('; '));
  return payload.data;
}

export function createLuksoProfileRepository({
  endpoint = LUKSO_INDEXER_URL,
  fetchImpl = globalThis.fetch,
  pageSize = LIBRARY_PAGE_SIZE
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  return {
    source: 'LIVE', endpoint,
    async *loadProfileAssets(profileAddress, { signal } = {}) {
      const profile = normalizeProfileAddress(profileAddress);
      if (!profile) throw new TypeError('A valid Universal Profile address is required');
      let offset = 0;
      let total = null;
      do {
        const data = await requestPage({ endpoint, fetchImpl, profileAddress: profile, limit: pageSize, offset, signal });
        total = Number(data?.Hold_aggregate?.aggregate?.count) || 0;
        const holdings = Array.isArray(data?.Hold) ? data.Hold : [];
        const records = holdings.map((holding) => normalizeProfileAsset(holding, profile)).filter(Boolean);
        const images = records.filter((asset) => asset.imageUrl);
        const failures = records.filter((asset) => asset.metadataStatus === 'unavailable' || !asset.imageUrl).length;
        offset += holdings.length;
        yield { assets: images, resolved: offset, total, failures, complete: offset >= total || holdings.length === 0 };
        if (!holdings.length) break;
      } while (offset < total);
    }
  };
}

export const luksoProfileRepository = createLuksoProfileRepository();
