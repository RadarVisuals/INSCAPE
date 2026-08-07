import { normalizeProfileAddress } from '../../library/config.js';
import { creatorRelationshipForProfile } from '../../creations/domain/creatorRelationship.js';
import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';
import { resolvePublishedAssetUrl } from '../../profileDocument/domain/publishedAssetUrl.js';

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
  return Object.freeze(value);
}

export function adaptLatticeProductionBrowserAsset(asset, profileAddress, acceptCreated = false) {
  const ownerAddress = normalizeProfileAddress(asset?.ownerAddress);
  const identity = parseCanonicalAssetId(asset?.id);
  const createdForProfile = acceptCreated && Boolean(creatorRelationshipForProfile(asset, profileAddress));
  if (!identity || (ownerAddress !== profileAddress && !createdForProfile)
    || Number(asset?.chainId) !== identity.chainId
    || normalizeProfileAddress(asset?.contractAddress) !== identity.contractAddress
    || (asset?.tokenId == null ? null : String(asset.tokenId).toLowerCase()) !== identity.tokenId) return null;

  const previewSource = [asset.thumbnailUrl, asset.imageUrl, asset.originalImageUrl]
    .map((candidate) => resolvePublishedAssetUrl(candidate))
    .find(Boolean) || null;
  const previewCandidates = [...new Set([asset.thumbnailUrl, asset.imageUrl, asset.originalImageUrl]
    .map((candidate) => resolvePublishedAssetUrl(candidate)).filter(Boolean))];
  const source = [asset.originalImageUrl, asset.imageUrl, asset.thumbnailUrl]
    .map((candidate) => resolvePublishedAssetUrl(candidate))
    .find(Boolean) || null;
  const width = Number.isSafeInteger(asset.imageWidth) && asset.imageWidth > 0 ? asset.imageWidth : null;
  const height = Number.isSafeInteger(asset.imageHeight) && asset.imageHeight > 0 ? asset.imageHeight : null;
  const declaredMediaType = typeof asset.mediaType === 'string' && asset.mediaType.trim()
    ? asset.mediaType.trim().toLowerCase() : null;
  // Production Library records are normalized from metadata `images` and currently
  // do not persist a separate mediaType field. A validated image source therefore
  // supplies the honest legacy/default type; explicit unsupported types still fail.
  const mediaType = declaredMediaType || (source ? 'image' : 'unknown');
  return {
    collection: typeof asset.collectionName === 'string' && asset.collectionName.trim()
      ? asset.collectionName.trim().slice(0, 80) : null,
    height,
    isCollection: asset?.isCollection === true,
    mediaType,
    placeable: Boolean(source && width && height && ['image', 'animation'].includes(mediaType)),
    placementUnavailableReason: !source ? 'MEDIA UNAVAILABLE'
      : !width || !height ? 'DIMENSIONS RESOLVING'
        : !['image', 'animation'].includes(mediaType) ? 'MEDIA TYPE UNAVAILABLE' : null,
    previewSrc: previewSource,
    previewCandidates,
    src: source,
    stableAssetId: identity.stableAssetId,
    title: typeof asset.name === 'string' && asset.name.trim()
      ? asset.name.trim().slice(0, 80) : null,
    width,
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
      readOnly: false,
    });
  }

  const acceptedAssets = [];
  let rejectedAssetCount = 0;
  const seen = new Set();
  for (const candidate of Array.isArray(assets) ? assets : []) {
    const accepted = adaptLatticeProductionBrowserAsset(candidate, profile);
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
    readOnly: false,
  });
}
