import { LUKSO_CHAIN_ID, normalizeProfileAddress } from '../../library/config.js';
import { selectImageGroups } from '../../library/data/resolveContentUrl.js';
import { createStableAssetId } from '../../library/domain/normalizeProfileAsset.js';

function normalizeCreator(entry) {
  const address = normalizeProfileAddress(entry?.profile_id || entry?.address);
  return address ? { address, name: entry?.profile?.name || entry?.name || null } : null;
}

function hasPositiveBalance(holding) {
  if (holding?.balance == null) return true;
  try { return BigInt(holding.balance) > 0n; } catch { return Number(holding.balance) > 0; }
}

function indexedFieldSource(token, tokenValue, contractValue) {
  if (token && tokenValue != null && tokenValue !== '') {
    return { scope: 'tokenId', source: 'LUKSO INDEXER / LSP4 TOKEN METADATA' };
  }
  if (contractValue != null && contractValue !== '') {
    return { scope: 'contract', source: 'LUKSO INDEXER / LSP4 CONTRACT METADATA' };
  }
  return null;
}

export function normalizeCreatorAttribution(record, viewedProfileAddress, options = {}) {
  const viewedProfile = normalizeProfileAddress(viewedProfileAddress);
  const attributionProfile = normalizeProfileAddress(record?.profile_id);
  if (!viewedProfile || attributionProfile !== viewedProfile) return null;

  const token = record?.token || null;
  const asset = token?.asset || record?.asset || null;
  const contractAddress = normalizeProfileAddress(asset?.id || record?.asset_id || String(record?.token_id || '').slice(0, 42));
  if (!contractAddress) return null;
  const tokenId = token?.tokenId ? String(token.tokenId).toLowerCase() : null;
  const metadata = token || asset || {};
  const creatorSource = metadata.lsp4Creators?.length ? metadata.lsp4Creators : asset?.lsp4Creators || [];
  const creators = creatorSource.map(normalizeCreator).filter(Boolean);
  if (!creators.some((creator) => creator.address === viewedProfile)) return null;

  const imageGroups = selectImageGroups(metadata.images?.length ? metadata.images : asset?.images, options);
  const primaryImage = imageGroups[0] || { imageUrl: null, thumbnailUrl: null, originalImageUrl: null };
  const name = metadata.name || metadata.lsp4TokenName || asset?.name || asset?.lsp4TokenName
    || (tokenId ? `Token ${tokenId.slice(0, 10)}…` : 'Unnamed creation');
  const collectionName = token ? (asset?.name || asset?.lsp4TokenName || null) : (asset?.isCollection ? asset?.name || asset?.lsp4TokenName || null : null);
  const holders = Array.isArray(metadata.holders) ? metadata.holders : [];
  const isOwnedByViewedProfile = holders.some((holding) => normalizeProfileAddress(holding?.profile_id) === viewedProfile && hasPositiveBalance(holding));
  const currentOwnerAddress = token
    ? normalizeProfileAddress(holders.find(hasPositiveBalance)?.profile_id)
    : isOwnedByViewedProfile ? viewedProfile : null;
  const metadataStatus = metadata.error ? 'unavailable' : (!primaryImage.imageUrl || !metadata.description || name === 'Unnamed creation') ? 'partial' : 'ready';

  return {
    id: createStableAssetId({ chainId: LUKSO_CHAIN_ID, contractAddress, tokenId }), chainId: LUKSO_CHAIN_ID,
    contractAddress, tokenId,
    standard: token ? 'LSP8' : asset?.isLSP7 ? 'LSP7' : String(asset?.standard || 'unknown'),
    name, description: metadata.description || asset?.description || '', collectionName,
    imageUrl: primaryImage.imageUrl, thumbnailUrl: primaryImage.thumbnailUrl, originalImageUrl: primaryImage.originalImageUrl,
    imageGroups,
    imageWidth: primaryImage.width || null, imageHeight: primaryImage.height || null,
    mediaFileType: primaryImage.fileType || null,
    creators, viewedProfileIsCreator: true, creatorAttributionLevel: token ? 'token' : 'contract',
    currentOwnerAddress,
    isOwnedByViewedProfile, ownershipKnown: true,
    attributes: (metadata.attributes || []).map(({ key, value, attributeType }) => ({ key, value, type: attributeType })),
    metadataStatus,
    fieldProvenance: {
      name: indexedFieldSource(token, token?.name || token?.lsp4TokenName, asset?.name || asset?.lsp4TokenName),
      description: indexedFieldSource(token, token?.description, asset?.description),
      images: indexedFieldSource(token, token?.images?.length ? token.images : null, asset?.images?.length ? asset.images : null),
      attributes: indexedFieldSource(token, token?.attributes?.length ? token.attributes : null,
        !token && asset?.attributes?.length ? asset.attributes : null),
      creators: { scope: token ? 'tokenId' : 'contract', source: 'LUKSO INDEXER / LSP4 CREATORS' },
    },
    rawMetadata: { indexerAttributionId: record?.id || null, indexerMetadataError: metadata.error || null, originalImageUrl: primaryImage.originalImageUrl }
  };
}

export function deduplicateCreations(creations) {
  const byId = new Map();
  for (const creation of creations || []) {
    if (!creation?.id) continue;
    const previous = byId.get(creation.id);
    if (!previous) { byId.set(creation.id, creation); continue; }
    const creators = [...new Map([...(previous.creators || []), ...(creation.creators || [])].map((creator) => [creator.address, creator])).values()];
    const imageGroups = [...new Map([...(previous.imageGroups || []), ...(creation.imageGroups || [])]
      .map((group) => [`${group.index}:${group.imageUrl}`, group])).values()].sort((first, second) => first.index - second.index);
    const primaryImage = imageGroups[0] || creation || previous;
    byId.set(creation.id, {
      ...previous, ...creation, creators,
      imageGroups,
      imageUrl: primaryImage.imageUrl || null,
      thumbnailUrl: primaryImage.thumbnailUrl || null,
      originalImageUrl: primaryImage.originalImageUrl || null,
      viewedProfileIsCreator: previous.viewedProfileIsCreator || creation.viewedProfileIsCreator,
      isOwnedByViewedProfile: previous.isOwnedByViewedProfile || creation.isOwnedByViewedProfile,
      currentOwnerAddress: previous.currentOwnerAddress || creation.currentOwnerAddress,
      creatorAttributionLevel: previous.creatorAttributionLevel === creation.creatorAttributionLevel ? previous.creatorAttributionLevel : 'contract-and-token'
    });
  }
  return [...byId.values()];
}
