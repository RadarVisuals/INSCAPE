import { LIBRARY_PAGE_SIZE, LUKSO_INDEXER_URL, normalizeProfileAddress } from '../../library/config.js';
import { deduplicateCreations, normalizeCollectionToken, normalizeCreatorAttribution } from '../domain/normalizeCreation.js';

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
      tokens(limit: 1, order_by: { id: asc }) { tokenId }
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
      holders { id profile_id balance }
      asset {
        id name lsp4TokenName standard isLSP7 isCollection description error
        images(where: { error: { _is_null: true } }, order_by: [{ index: asc }, { width: asc }]) { index src url width height fileType error }
        lsp4Creators { profile_id profile { name } }
      }
    }
  }
  TokenCreators_aggregate(where: { profile_id: { _eq: $profile } }) { aggregate { count } }
}`;

export const COLLECTION_TOKENS_QUERY = `
query CollectionTokens($contract: String!, $limit: Int!, $offset: Int!) {
  Token(where: { _or: [{ asset_id: { _eq: $contract } }, { baseAsset_id: { _eq: $contract } }] }, limit: $limit, offset: $offset, order_by: { id: asc }) {
    id tokenId formattedTokenId name lsp4TokenName description error
    images(where: { error: { _is_null: true } }, order_by: [{ index: asc }, { width: asc }]) { index src url width height fileType error }
    lsp4Creators { profile_id profile { name } }
    attributes { key value attributeType }
    holders { id profile_id balance }
    asset {
      id name lsp4TokenName standard isLSP7 isCollection description error
      images(where: { error: { _is_null: true } }, order_by: [{ index: asc }, { width: asc }]) { index src url width height fileType error }
      lsp4Creators { profile_id profile { name } }
    }
    baseAsset {
      id name lsp4TokenName standard isLSP7 isCollection description error
      images(where: { error: { _is_null: true } }, order_by: [{ index: asc }, { width: asc }]) { index src url width height fileType error }
      lsp4Creators { profile_id profile { name } }
    }
  }
  Token_aggregate(where: { _or: [{ asset_id: { _eq: $contract } }, { baseAsset_id: { _eq: $contract } }] }) { aggregate { count } }
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

async function requestCollectionPage({ contract, endpoint, fetchImpl, limit, offset, signal }) {
  const response = await fetchImpl(endpoint, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: COLLECTION_TOKENS_QUERY, variables: { contract, limit, offset } })
  });
  if (!response.ok) throw new Error(`LUKSO indexer responded ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors.map((entry) => entry.message).join('; '));
  return payload.data;
}

export function createLuksoCreationsRepository({
  endpoint = LUKSO_INDEXER_URL, fetchImpl = globalThis.fetch, pageSize = LIBRARY_PAGE_SIZE,
  collectionMetadataResolver,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  return {
    source: 'LIVE', endpoint,
    async *loadCollectionTokens(viewedProfileAddress, collectionRecord, { signal } = {}) {
      const profile = normalizeProfileAddress(viewedProfileAddress);
      const contract = normalizeProfileAddress(collectionRecord?.contractAddress);
      if (!profile) throw new TypeError('A valid viewed Universal Profile address is required');
      if (!contract || collectionRecord?.isCollection !== true) throw new TypeError('A valid creator collection is required');
      let offset = 0;
      let total = null;
      do {
        const data = await requestCollectionPage({ contract, endpoint, fetchImpl, limit: pageSize, offset, signal });
        let rows = Array.isArray(data?.Token) ? data.Token : [];
        total = Number(data?.Token_aggregate?.aggregate?.count) || 0;
        if (rows.length && collectionMetadataResolver !== null) {
          const { refreshIndexedCollectionTokens } = await import('./lsp8CollectionMetadataResolver.js');
          rows = await refreshIndexedCollectionTokens(contract, rows, { resolver: collectionMetadataResolver, signal });
        }
        const assets = deduplicateCreations(rows
          .map((token) => normalizeCollectionToken(token, collectionRecord, profile)).filter(Boolean));
        offset += rows.length;
        const complete = offset >= total;
        yield { assets, resolved: offset, total,
          failures: assets.filter((asset) => !asset.imageUrl || asset.metadataStatus === 'unavailable').length, complete };
        if (!rows.length) break;
      } while (offset < total);
    },
    async *loadCreations(viewedProfileAddress, { signal } = {}) {
      const profile = normalizeProfileAddress(viewedProfileAddress);
      if (!profile) throw new TypeError('A valid viewed Universal Profile address is required');
      let assetOffset = 0;
      let tokenOffset = 0;
      let assetTotal = null;
      let tokenTotal = null;
      do {
        const data = await requestPage({ endpoint, fetchImpl, profile, limit: pageSize, assetOffset, tokenOffset, signal });
        let assetRows = Array.isArray(data?.AssetCreators) ? data.AssetCreators : [];
        const tokenRows = Array.isArray(data?.TokenCreators) ? data.TokenCreators : [];
        assetTotal = Number(data?.AssetCreators_aggregate?.aggregate?.count) || 0;
        tokenTotal = Number(data?.TokenCreators_aggregate?.aggregate?.count) || 0;
        if (collectionMetadataResolver !== null && assetRows.some((row) => row?.asset?.isCollection
          && !row.asset.images?.length && row.asset.tokens?.[0]?.tokenId)) {
          const { resolveMissingCollectionPreviews } = await import('./lsp8CollectionMetadataResolver.js');
          assetRows = await resolveMissingCollectionPreviews(assetRows, { resolver: collectionMetadataResolver, signal });
        }
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
