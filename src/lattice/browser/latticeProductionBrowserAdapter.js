import { normalizeProfileAddress } from '../../library/config.js';
import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';
import { resolvePublishedAssetUrl } from '../../profileDocument/domain/publishedAssetUrl.js';

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
  return Object.freeze(value);
}

function browserAsset(asset, profileAddress) {
  const ownerAddress = normalizeProfileAddress(asset?.ownerAddress);
  const identity = parseCanonicalAssetId(asset?.id);
  if (!identity || ownerAddress !== profileAddress
    || Number(asset?.chainId) !== identity.chainId
    || normalizeProfileAddress(asset?.contractAddress) !== identity.contractAddress
    || (asset?.tokenId == null ? null : String(asset.tokenId).toLowerCase()) !== identity.tokenId) return null;

  const source = [asset.thumbnailUrl, asset.imageUrl, asset.originalImageUrl]
    .map((candidate) => resolvePublishedAssetUrl(candidate))
    .find(Boolean) || null;
  return {
    collection: typeof asset.collectionName === 'string' && asset.collectionName.trim()
      ? asset.collectionName.trim().slice(0, 80) : null,
    height: Number.isSafeInteger(asset.imageHeight) && asset.imageHeight > 0 ? asset.imageHeight : null,
    mediaType: typeof asset.mediaType === 'string' && asset.mediaType.trim()
      ? asset.mediaType.trim().toLowerCase() : 'unknown',
    placeable: false,
    src: source,
    stableAssetId: identity.stableAssetId,
    title: typeof asset.name === 'string' && asset.name.trim()
      ? asset.name.trim().slice(0, 80) : null,
    width: Number.isSafeInteger(asset.imageWidth) && asset.imageWidth > 0 ? asset.imageWidth : null,
  };
}

export function adaptLatticeProductionBrowserData({
  assets,
  error = null,
  profileAddress,
  progress,
  status = 'idle',
  workspace,
} = {}) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile || normalizeProfileAddress(workspace?.profileAddress) !== profile) {
    return deepFreeze({
      assetError: null,
      assetLoadState: 'idle',
      assetProgress: { failures: 0, resolved: 0, total: 0 },
      assets: [],
      categories: [],
      favorites: [],
      ownerContext: profile,
      rejectedAssetCount: 0,
      readOnly: true,
    });
  }

  const acceptedAssets = [];
  let rejectedAssetCount = 0;
  const seen = new Set();
  for (const candidate of Array.isArray(assets) ? assets : []) {
    const accepted = browserAsset(candidate, profile);
    if (!accepted || seen.has(accepted.stableAssetId)) {
      rejectedAssetCount += 1;
      continue;
    }
    seen.add(accepted.stableAssetId);
    acceptedAssets.push(accepted);
  }

  const categories = (Array.isArray(workspace.folders) ? workspace.folders : []).map((folder) => ({
    assetIds: [...folder.assetIds],
    id: folder.id,
    name: folder.name,
    public: folder.public === true,
  }));
  return deepFreeze({
    assetError: typeof error === 'string' ? error : null,
    assetLoadState: ['idle', 'loading', 'ready', 'partial', 'error'].includes(status) ? status : 'error',
    assetProgress: {
      failures: Number.isFinite(progress?.failures) ? progress.failures : 0,
      resolved: Number.isFinite(progress?.resolved) ? progress.resolved : 0,
      total: Number.isFinite(progress?.total) ? progress.total : 0,
    },
    assets: acceptedAssets,
    categories,
    favorites: [...workspace.favorites],
    ownerContext: profile,
    rejectedAssetCount,
    readOnly: true,
  });
}
