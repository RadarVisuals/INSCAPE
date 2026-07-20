import { resolvePublishedAssetUrl } from './publishedAssetUrl.js';

export function projectDocumentAsset(reference, liveAssets = []) {
  const live = liveAssets.find((asset) => asset.id === reference.stableAssetId);
  if (live) return live;
  const fallbackUrl = resolvePublishedAssetUrl(reference.cachedPreviewUrl) || null;
  return {
    id: reference.stableAssetId, chainId: reference.chainId, contractAddress: reference.contractAddress,
    tokenId: reference.tokenId, standard: reference.tokenStandard, name: reference.cachedName || 'Unavailable asset',
    description: '', collectionName: null, imageUrl: fallbackUrl, thumbnailUrl: fallbackUrl,
    originalImageUrl: fallbackUrl, metadataStatus: 'unavailable', creators: [], attributes: [], rawMetadata: {}
  };
}
export function projectDocumentSpace(space, liveAssets = []) { return space.assets.map((asset) => projectDocumentAsset(asset, liveAssets)); }
