import { LIBRARY_PAGE_SIZE, LUKSO_INDEXER_URL, normalizeProfileAddress } from '../../library/config.js';
import { deduplicateCreations, normalizeCreatorAttribution } from '../domain/normalizeCreation.js';

export const CREATIONS_QUERY = `
query ProfileCreations($profile: String!, $limit: Int!, $assetOffset: Int!, $tokenOffset: Int!) {
  AssetCreators(where: { profile_id: { _eq: $profile } }, limit: $limit, offset: $assetOffset, order_by: { id: asc }) {
    id profile_id asset_id
    asset {
      id name lsp4TokenName standard isLSP7 isCollection description error
      images(where: { error: { _is_null: true } }, order_by: [{ index: asc }, { width: asc }]) { index src url width height fileType error }
      lsp4Creators { profile_id profile { name } }
      attributes { key value attributeType }
      holders(where: { profile_id: { _eq: $profile } }) { id profile_id balance }
    }
  }
  AssetCreators_aggregate(where: { profile_id: { _eq: $profile } }) { aggregate { count } }
  TokenCreators(where: { profile_id: { _eq: $profile } }, limit: $limit, offset: $tokenOffset, order_by: { id: asc }) {
    id profile_id token_id
    token {
      id tokenId formattedTokenId name lsp4TokenName description error
      images(where: { error: { _is_null: true } }, order_by: [{ index: asc }, { width: asc }]) { index src url width height fileType error }
      lsp4Creators { profile_id profile { name } }
      attributes { key value attributeType }
      holders(where: { profile_id: { _eq: $profile } }) { id profile_id balance }
      asset {
        id name lsp4TokenName standard isLSP7 isCollection description error
        images(where: { error: { _is_null: true } }, order_by: [{ index: asc }, { width: asc }]) { index src url width height fileType error }
        lsp4Creators { profile_id profile { name } }
      }
    }
  }
  TokenCreators_aggregate(where: { profile_id: { _eq: $profile } }) { aggregate { count } }
}`;

async function requestPage({ endpoint, fetchImpl, profile, limit, assetOffset, tokenOffset, signal }) {
  const response = await fetchImpl(endpoint, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: CREATIONS_QUERY, variables: { profile, limit, assetOffset, tokenOffset } })
  });
  if (!response.ok) throw new Error(`LUKSO indexer responded ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors.map((entry) => entry.message).join('; '));
  return payload.data;
}

export function createLuksoCreationsRepository({ endpoint = LUKSO_INDEXER_URL, fetchImpl = globalThis.fetch, pageSize = LIBRARY_PAGE_SIZE } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  return {
    source: 'LIVE', endpoint,
    async *loadCreations(viewedProfileAddress, { signal } = {}) {
      const profile = normalizeProfileAddress(viewedProfileAddress);
      if (!profile) throw new TypeError('A valid viewed Universal Profile address is required');
      let assetOffset = 0;
      let tokenOffset = 0;
      let assetTotal = null;
      let tokenTotal = null;
      do {
        const data = await requestPage({ endpoint, fetchImpl, profile, limit: pageSize, assetOffset, tokenOffset, signal });
        const assetRows = Array.isArray(data?.AssetCreators) ? data.AssetCreators : [];
        const tokenRows = Array.isArray(data?.TokenCreators) ? data.TokenCreators : [];
        assetTotal = Number(data?.AssetCreators_aggregate?.aggregate?.count) || 0;
        tokenTotal = Number(data?.TokenCreators_aggregate?.aggregate?.count) || 0;
        const assets = deduplicateCreations([...assetRows, ...tokenRows].map((row) => normalizeCreatorAttribution(row, profile)).filter(Boolean));
        assetOffset += assetRows.length;
        tokenOffset += tokenRows.length;
        const complete = assetOffset >= assetTotal && tokenOffset >= tokenTotal;
        yield { assets, resolved: assetOffset + tokenOffset, total: assetTotal + tokenTotal,
          failures: assets.filter((asset) => !asset.imageUrl || asset.metadataStatus === 'unavailable').length, complete };
        if (!assetRows.length && !tokenRows.length) break;
      } while (assetOffset < assetTotal || tokenOffset < tokenTotal);
    }
  };
}

export const luksoCreationsRepository = createLuksoCreationsRepository();
