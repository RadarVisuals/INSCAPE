import { CHILLWHALES_INDEXER_URL, IPFS_GATEWAY_URL, normalizeProfileAddress } from '../config.js';
import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';
import { normalizeOwnedAsset, normalizeOwnedToken } from './chillwhalesProfileRepository.js';

export const PROFILE_ASSET_REFERENCES_QUERY = `
fragment InscapeReferencedMetadata on lsp4_metadata {
  name { value }
  description { value }
  decode_error fetch_error_code fetch_error_message
  images(order_by: [{ image_index: asc }, { width: asc }]) { image_index url width height }
  icon(order_by: { width: asc }) { url width height }
  assets { url file_type }
  attributes { key value type }
}
fragment InscapeReferencedDigitalAsset on digital_asset {
  address
  lsp4TokenName { value }
  lsp4TokenType { value }
  lsp4Creators(order_by: { array_index: asc }) {
    creator_address
    creatorProfile { address lsp3Profile { name { value } } }
  }
  lsp4Metadata { ...InscapeReferencedMetadata }
}
query InscapeProfileAssetReferences($owner: String!, $contracts: [String!]!, $tokenIds: [String!]!) {
  owned_asset(where: { owner: { _ilike: $owner }, address: { _in: $contracts } }) {
    id address owner balance
    tokenIds_aggregate { aggregate { count } }
    digitalAsset { ...InscapeReferencedDigitalAsset }
  }
  owned_token(where: {
    owner: { _ilike: $owner }, address: { _in: $contracts }, token_id: { _in: $tokenIds }
  }) {
    id address owner token_id
    digitalAsset { ...InscapeReferencedDigitalAsset }
    nft {
      lsp4Metadata { ...InscapeReferencedMetadata }
      lsp4MetadataBaseUri { ...InscapeReferencedMetadata }
    }
  }
}`;

export function createChillwhalesProfileReferencesRepository({
  endpoint = CHILLWHALES_INDEXER_URL,
  fetchImpl = globalThis.fetch,
  ipfsGateway = IPFS_GATEWAY_URL,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  return {
    source: 'INDEXER', endpoint,
    async *loadProfileAssetReferences(profileAddress, stableAssetIds, { signal } = {}) {
      const profile = normalizeProfileAddress(profileAddress);
      if (!profile) throw new TypeError('A valid Universal Profile address is required');
      const references = [...new Map((stableAssetIds || []).map((assetId) => parseCanonicalAssetId(assetId))
        .filter((reference) => reference?.chainId === 42)
        .map((reference) => [reference.stableAssetId, reference])).values()];
      if (!references.length) {
        yield { assets: [], unresolvedAssetIds: [], resolved: 0, total: 0, failures: 0, complete: true };
        return;
      }
      const response = await fetchImpl(endpoint, {
        method: 'POST', signal,
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ query: PROFILE_ASSET_REFERENCES_QUERY, variables: {
          owner: profile,
          contracts: [...new Set(references.map(({ contractAddress }) => contractAddress))],
          tokenIds: [...new Set(references.map(({ tokenId }) => tokenId).filter(Boolean))],
        } }),
      });
      if (!response.ok) throw new Error(`Chillwhales indexer responded ${response.status}`);
      const payload = await response.json();
      if (payload.errors?.length) throw new Error(payload.errors.map(({ message }) => message).join('; '));
      const requestedIds = new Set(references.map(({ stableAssetId }) => stableAssetId));
      const contractAssets = (payload.data?.owned_asset || [])
        .filter((row) => normalizeProfileAddress(row?.owner) === profile)
        .filter((row) => Number(row?.tokenIds_aggregate?.aggregate?.count) === 0)
        .map((row) => normalizeOwnedAsset(row, profile, { ipfsGateway }));
      const tokenAssets = (payload.data?.owned_token || [])
        .filter((row) => normalizeProfileAddress(row?.owner) === profile)
        .map((row) => normalizeOwnedToken(row, profile, { ipfsGateway }));
      const records = [...contractAssets, ...tokenAssets].filter((asset) => asset && requestedIds.has(asset.id));
      const assets = records.filter(({ imageUrl }) => imageUrl);
      const unresolvedAssetIds = records.filter(({ imageUrl }) => !imageUrl).map(({ id }) => id);
      yield { assets, unresolvedAssetIds, resolved: records.length, total: references.length,
        failures: unresolvedAssetIds.length, complete: true };
    },
  };
}

export const chillwhalesProfileReferencesRepository = createChillwhalesProfileReferencesRepository();
