import { LUKSO_CHAIN_ID, LUKSO_INDEXER_URL, IPFS_GATEWAY_URL, LIBRARY_PAGE_SIZE, normalizeProfileAddress } from '../config.js';
import { normalizeProfileAsset } from '../domain/normalizeProfileAsset.js';
import { metadataImages } from './metadataImages.js';
import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';

// Official HTTP API: https://docs.lukso.network/tools/apis/indexer-api/
// Hold/Token/Asset fields checked against the mainnet schema on 2026-10-31.
const ASSET_FRAGMENT = `fragment InscapeEnvioAsset on Asset {
  id name lsp4TokenName lsp4TokenType isLSP7 isCollection description error
  images(order_by: [{index: asc}, {width: asc}]) { index url src width height fileType method data error }
  icons(order_by: {width: asc}) { url src width height fileType method data error }
  assets(order_by: {id: asc}) { url src width height fileType method data error }
  attributes(order_by: {id: asc}) { key value attributeType }
  lsp4Creators(order_by: {index: asc}) { profile_id profile { name } }
}`;

const PROFILE_ASSETS_QUERY = `${ASSET_FRAGMENT}
query InscapeEnvioProfileAssets($profile: String!, $limit: Int!, $offset: Int!, $filter: Hold_bool_exp!) {
  Hold(where: {profile_id: {_eq: $profile}, balance: {_gt: "0"},
    _or: [{token_id: {_is_null: false}}, {asset: {isLSP7: {_eq: true}}}], _and: [$filter]},
    order_by: [{blockNumber: desc}, {id: asc}], limit: $limit, offset: $offset) {
    id profile_id balance asset_id baseAsset_id token_id
    asset { ...InscapeEnvioAsset }
    baseAsset { ...InscapeEnvioAsset }
    token {
      tokenId baseAsset_id name description error
      images(order_by: [{index: asc}, {width: asc}]) { index url src width height fileType method data error }
      icons(order_by: {width: asc}) { url src width height fileType method data error }
      assets(order_by: {id: asc}) { url src width height fileType method data error }
      attributes(order_by: {id: asc}) { key value attributeType }
      lsp4Creators(order_by: {index: asc}) { profile_id profile { name } }
    }
  }
  Hold_aggregate(where: {profile_id: {_eq: $profile}, balance: {_gt: "0"},
    _or: [{token_id: {_is_null: false}}, {asset: {isLSP7: {_eq: true}}}], _and: [$filter]}) { aggregate { count } }
}`;

const tokenIdPattern = /^0x[0-9a-f]{64}$/iu;
const source = 'LUKSO Envio Indexer';

function imagesFor(record) {
  const media = entries => (Array.isArray(entries) ? entries : []).filter(entry => entry && !entry.error)
    .map(entry => ({ url: entry.url || entry.src, width: entry.width, height: entry.height,
      image_index: entry.index, fileType: entry.fileType,
      ...(entry.method && entry.data ? { verification: { method: entry.method, data: entry.data } } : {}),
    }));
  return metadataImages({ images: media(record?.images), icon: media(record?.icons), assets: media(record?.assets) }, { indexed: true });
}

function metadataFor(record = {}) {
  return {
    id: record.id, name: record.name || record.lsp4TokenName || null,
    lsp4TokenName: record.lsp4TokenName || null, description: record.description || '',
    images: imagesFor(record),
    attributes: (record.attributes || []).map(entry => ({ key: entry.key, value: entry.value, attributeType: entry.attributeType })),
    lsp4Creators: (record.lsp4Creators || []).filter(entry => normalizeProfileAddress(entry.profile_id)),
    lsp4TokenType: ['TOKEN', 'NFT', 'COLLECTION'][record.lsp4TokenType] || null,
    isLSP7: record.isLSP7 === true, isCollection: record.isCollection === true,
    metadataSource: source, tokenTypeSource: 'LSP4TokenType', error: record.error || null,
  };
}

export function normalizeEnvioHolding(row, ownerAddress, options) {
  const profile = normalizeProfileAddress(ownerAddress);
  if (!profile || normalizeProfileAddress(row?.profile_id) !== profile
    || typeof row.id !== 'string' || !/^\d+$/u.test(String(row.balance)) || BigInt(row.balance) <= 0n)
    throw new Error('Envio returned an invalid profile holding');
  const isToken = row.token_id != null;
  const contractAddress = normalizeProfileAddress(isToken ? row.baseAsset_id : row.asset_id);
  if (!contractAddress) throw new Error('Envio returned an invalid asset address');
  const contract = isToken ? row.baseAsset : row.asset;
  if (contract && normalizeProfileAddress(contract.id) !== contractAddress)
    throw new Error('Envio returned mismatched contract metadata');
  const contractMetadata = metadataFor(contract || { id: contractAddress });
  if (!isToken) {
    if (!contractMetadata.isLSP7) throw new Error('Envio returned an unsupported contract holding');
    return normalizeProfileAsset({ id: row.id, balance: row.balance, asset_id: contractAddress,
      asset: contractMetadata }, profile, options);
  }
  const tokenId = String(row.token_id).slice(contractAddress.length + 1).toLowerCase();
  if (!tokenIdPattern.test(tokenId) || row.token_id.toLowerCase() !== `${contractAddress}-${tokenId}`
    || row.token && (row.token.tokenId?.toLowerCase() !== tokenId
      || normalizeProfileAddress(row.token.baseAsset_id) !== contractAddress))
    throw new Error('Envio returned mismatched token metadata');
  return normalizeProfileAsset({ id: row.id, balance: row.balance, asset_id: contractAddress,
    token: { ...metadataFor(row.token || { error: 'Token metadata unavailable' }), tokenId, asset: contractMetadata },
  }, profile, options);
}

export function createLuksoEnvioProfileRepository({ endpoint = LUKSO_INDEXER_URL, fetchImpl = globalThis.fetch,
  ipfsGateway = IPFS_GATEWAY_URL, pageSize = LIBRARY_PAGE_SIZE } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new TypeError('Invalid inventory page size');
  return {
    source: 'INDEXER', endpoint,
    async *loadProfileAssets(profileAddress, { signal, requestedAssetIds = null } = {}) {
      const profile = normalizeProfileAddress(profileAddress);
      if (!profile) throw new TypeError('A valid Universal Profile address is required');
      const references = requestedAssetIds === null ? null : requestedAssetIds.map(parseCanonicalAssetId);
      if (references?.some(ref => !ref || ref.chainId !== LUKSO_CHAIN_ID || ref.tokenId && !tokenIdPattern.test(ref.tokenId)))
        throw new TypeError('Invalid LUKSO asset ID');
      signal?.throwIfAborted();
      const requested = references && new Set(references.map(ref => ref.stableAssetId));
      if (requested?.size === 0) {
        yield { assets: [], unresolvedAssetIds: [], resolved: 0, total: 0, failures: 0, complete: true }; return;
      }
      const filter = references ? { _or: references.map(ref => ref.tokenId
        ? { token_id: { _eq: `${ref.contractAddress}-${ref.tokenId}` } }
        : { asset_id: { _eq: ref.contractAddress }, token_id: { _is_null: true } }) } : {};
      const seen = new Set(); let offset = 0;
      for (;;) {
        signal?.throwIfAborted();
        const response = await fetchImpl(endpoint, { method: 'POST', signal,
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ query: PROFILE_ASSETS_QUERY, variables: { profile, limit: pageSize, offset, filter } }),
        });
        if (!response.ok) throw new Error(`LUKSO Envio indexer responded ${response.status}`);
        const payload = await response.json();
        signal?.throwIfAborted();
        if (payload.errors?.length) throw new Error(payload.errors.map(error => error.message).join('; '));
        const rows = payload.data?.Hold; const total = payload.data?.Hold_aggregate?.aggregate?.count;
        if (!Array.isArray(rows) || !Number.isSafeInteger(total) || total < 0 || rows.length > pageSize
          || offset + rows.length > total || !rows.length && offset < total)
          throw new Error('Envio inventory is incomplete or invalid. Retry to refresh.');
        const records = rows.map(row => normalizeEnvioHolding(row, profile, { ipfsGateway }));
        for (const asset of records) {
          if (seen.has(asset.id) || requested && !requested.has(asset.id))
            throw new Error('Envio returned duplicate or unexpected holdings. Retry to refresh.');
          seen.add(asset.id);
        }
        offset += rows.length;
        const complete = offset >= total;
        const unresolvedAssetIds = records.filter(asset => !asset.imageUrl || asset.metadataStatus === 'unavailable').map(asset => asset.id);
        // A category reference missing from the indexer still gets a direct
        // holding check through the existing referenced-asset RPC fallback.
        if (complete && requested) unresolvedAssetIds.push(...[...requested].filter(id => !seen.has(id)));
        yield { assets: records.filter(asset => asset.imageUrl), unresolvedAssetIds, resolved: offset, total,
          failures: unresolvedAssetIds.length, complete };
        if (complete) return;
      }
    },
  };
}

export const luksoEnvioProfileRepository = createLuksoEnvioProfileRepository();
