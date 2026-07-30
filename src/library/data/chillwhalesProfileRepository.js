import { CHILLWHALES_INDEXER_URL, IPFS_GATEWAY_URL, LIBRARY_PAGE_SIZE, normalizeProfileAddress } from '../config.js';
import { normalizeProfileAsset } from '../domain/normalizeProfileAsset.js';

const PROFILE_ASSETS_QUERY = `
fragment InscapeMetadata on lsp4_metadata {
  name { value }
  description { value }
  decode_error fetch_error_code fetch_error_message
  images(order_by: [{ image_index: asc }, { width: asc }]) { image_index url width height }
  icon(order_by: { width: asc }) { url width height }
  assets { url file_type }
  attributes { key value type }
}
fragment InscapeDigitalAsset on digital_asset {
  address
  lsp4TokenName { value }
  lsp4TokenType { value }
  lsp4Creators(order_by: { array_index: asc }) {
    creator_address
    creatorProfile { address lsp3Profile { name { value } } }
  }
  lsp4Metadata { ...InscapeMetadata }
}
query InscapeProfileAssets($owner: String!, $limit: Int!, $assetOffset: Int!, $tokenOffset: Int!) {
  owned_asset(
    where: { owner: { _ilike: $owner } }
    order_by: [{ block_number: desc }, { id: asc }]
    limit: $limit
    offset: $assetOffset
  ) {
    id address balance
    tokenIds_aggregate { aggregate { count } }
    digitalAsset { ...InscapeDigitalAsset }
  }
  owned_asset_aggregate(where: { owner: { _ilike: $owner } }) { aggregate { count } }
  owned_token(
    where: { owner: { _ilike: $owner } }
    order_by: [{ block_number: desc }, { id: asc }]
    limit: $limit
    offset: $tokenOffset
  ) {
    id address token_id
    digitalAsset { ...InscapeDigitalAsset }
    nft {
      lsp4Metadata { ...InscapeMetadata }
      lsp4MetadataBaseUri { ...InscapeMetadata }
    }
  }
  owned_token_aggregate(where: { owner: { _ilike: $owner } }) { aggregate { count } }
}`;

function metadataError(metadata) {
  return metadata?.decode_error || metadata?.fetch_error_message || metadata?.fetch_error_code || null;
}

function mergeTokenMetadata(nft) {
  const direct = nft?.lsp4Metadata || {};
  const base = nft?.lsp4MetadataBaseUri || {};
  const preferList = (key) => direct[key]?.length ? direct[key] : base[key] || [];
  return {
    ...base, ...direct,
    name: direct.name?.value ? direct.name : base.name,
    description: direct.description?.value ? direct.description : base.description,
    images: preferList('images'), icon: preferList('icon'), assets: preferList('assets'),
    attributes: preferList('attributes'),
    decode_error: direct.decode_error || base.decode_error,
    fetch_error_code: direct.fetch_error_code || base.fetch_error_code,
    fetch_error_message: direct.fetch_error_message || base.fetch_error_message
  };
}

function metadataImages(metadata) {
  let images = Array.isArray(metadata?.images) && metadata.images.length ? metadata.images : metadata?.icon;
  if (!Array.isArray(images) || !images.length) images = (Array.isArray(metadata?.assets) ? metadata.assets : [])
    .filter((asset) => !asset?.file_type || String(asset.file_type).toLowerCase().startsWith('image/'));
  return (Array.isArray(images) ? images : []).map((image) => ({
    index: Number.isInteger(image?.image_index) ? image.image_index : 0,
    url: image?.url || null,
    width: Number(image?.width) || null,
    height: Number(image?.height) || null,
    fileType: image?.file_type || null
  }));
}

function metadataAttributes(metadata) {
  return (Array.isArray(metadata?.attributes) ? metadata.attributes : []).map((attribute) => ({
    key: attribute?.key || '', value: attribute?.value ?? '', attributeType: attribute?.type || null
  })).filter((attribute) => attribute.key || attribute.value !== '');
}

function creatorsFor(digitalAsset) {
  return (Array.isArray(digitalAsset?.lsp4Creators) ? digitalAsset.lsp4Creators : []).map((creator) => {
    const address = normalizeProfileAddress(creator?.creator_address || creator?.creatorProfile?.address);
    if (!address) return null;
    return { profile_id: address, profile: { name: creator?.creatorProfile?.lsp3Profile?.name?.value || null } };
  }).filter(Boolean);
}

function contractMetadata(digitalAsset) {
  const metadata = digitalAsset?.lsp4Metadata || null;
  const tokenType = digitalAsset?.lsp4TokenType?.value || null;
  return {
    id: digitalAsset?.address,
    name: digitalAsset?.lsp4TokenName?.value || null,
    lsp4TokenName: digitalAsset?.lsp4TokenName?.value || null,
    description: metadata?.description?.value || '',
    images: metadataImages(metadata),
    lsp4Creators: creatorsFor(digitalAsset),
    lsp4TokenType: tokenType,
    metadataSource: 'LSP4Metadata', tokenTypeSource: 'LSP4TokenType',
    attributes: metadataAttributes(metadata),
    isLSP7: tokenType !== 'COLLECTION',
    isCollection: tokenType === 'COLLECTION',
    error: metadataError(metadata)
  };
}

function normalizeOwnedAsset(row, ownerAddress, options) {
  const contract = contractMetadata(row?.digitalAsset);
  return normalizeProfileAsset({
    id: row?.id,
    balance: row?.balance,
    asset_id: row?.address,
    asset: contract
  }, ownerAddress, options);
}

function normalizeOwnedToken(row, ownerAddress, options) {
  const contract = contractMetadata(row?.digitalAsset);
  const metadata = mergeTokenMetadata(row?.nft);
  return normalizeProfileAsset({
    id: row?.id,
    balance: '1',
    asset_id: row?.address,
    token: {
      tokenId: row?.token_id,
      name: metadata?.name?.value || null,
      lsp4TokenName: metadata?.name?.value || null,
      description: metadata?.description?.value || '',
      images: metadataImages(metadata),
      lsp4Creators: contract.lsp4Creators,
      attributes: metadataAttributes(metadata),
      metadataSource: row?.nft?.lsp4Metadata?.name?.value || row?.nft?.lsp4Metadata?.description?.value
        || row?.nft?.lsp4Metadata?.images?.length || row?.nft?.lsp4Metadata?.attributes?.length
        ? 'LSP4MetadataForTokenId' : 'LSP8MetadataBaseURI',
      asset: contract,
      error: metadataError(metadata)
    }
  }, ownerAddress, options);
}

async function requestPage({ endpoint, fetchImpl, profile, limit, assetOffset, tokenOffset, signal }) {
  const response = await fetchImpl(endpoint, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: PROFILE_ASSETS_QUERY,
      variables: { owner: profile, limit, assetOffset, tokenOffset } })
  });
  if (!response.ok) throw new Error(`Chillwhales indexer responded ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors.map((entry) => entry.message).join('; '));
  return payload.data || {};
}

export function createChillwhalesProfileRepository({
  endpoint = CHILLWHALES_INDEXER_URL,
  fetchImpl = globalThis.fetch,
  ipfsGateway = IPFS_GATEWAY_URL,
  pageSize = Math.max(LIBRARY_PAGE_SIZE, 48)
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  return {
    source: 'INDEXER', endpoint,
    async *loadProfileAssets(profileAddress, { signal } = {}) {
      const profile = normalizeProfileAddress(profileAddress);
      if (!profile) throw new TypeError('A valid Universal Profile address is required');
      let assetOffset = 0; let tokenOffset = 0; let assetTotal = null; let tokenTotal = null;
      let skippedCollectionWrappers = 0;
      do {
        const data = await requestPage({ endpoint, fetchImpl, profile, limit: pageSize,
          assetOffset, tokenOffset, signal });
        const assetRows = Array.isArray(data.owned_asset) ? data.owned_asset : [];
        const tokenRows = Array.isArray(data.owned_token) ? data.owned_token : [];
        assetTotal = Number(data?.owned_asset_aggregate?.aggregate?.count) || 0;
        tokenTotal = Number(data?.owned_token_aggregate?.aggregate?.count) || 0;
        const renderableAssetRows = assetRows.filter((row) => Number(row?.tokenIds_aggregate?.aggregate?.count) === 0);
        skippedCollectionWrappers += assetRows.length - renderableAssetRows.length;
        const contractAssets = renderableAssetRows
          .map((row) => normalizeOwnedAsset(row, profile, { ipfsGateway }));
        const tokenAssets = tokenRows.map((row) => normalizeOwnedToken(row, profile, { ipfsGateway }));
        const records = [...contractAssets, ...tokenAssets].filter(Boolean);
        const assets = records.filter((asset) => asset.imageUrl);
        const unresolvedAssetIds = records.filter((asset) => !asset.imageUrl).map((asset) => asset.id);
        const failures = unresolvedAssetIds.length;
        assetOffset += assetRows.length;
        tokenOffset += tokenRows.length;
        const complete = assetOffset >= assetTotal && tokenOffset >= tokenTotal;
        yield { assets, unresolvedAssetIds, resolved: assetOffset + tokenOffset - skippedCollectionWrappers,
          total: assetTotal + tokenTotal - skippedCollectionWrappers, failures, complete };
        if (!assetRows.length && !tokenRows.length) break;
      } while (assetOffset < assetTotal || tokenOffset < tokenTotal);
    }
  };
}

export const chillwhalesProfileRepository = createChillwhalesProfileRepository();
