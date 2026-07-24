import { normalizeProfileAddress } from '../config.js';
import { createStableAssetId } from '../domain/normalizeProfileAsset.js';

const CACHE_VERSION = 1;
const CACHE_KEY_PREFIX = 'inscape.library-assets.v1:';
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHED_ASSETS = 1000;

export function libraryAssetCacheKey(profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile) throw new TypeError('A valid profile address is required');
  return `${CACHE_KEY_PREFIX}${profile}`;
}

function normalizeCachedAsset(asset, profileAddress) {
  const contractAddress = normalizeProfileAddress(asset?.contractAddress);
  const ownerAddress = normalizeProfileAddress(asset?.ownerAddress);
  if (!contractAddress || ownerAddress !== profileAddress) return null;
  let id;
  try { id = createStableAssetId({ chainId: asset?.chainId, contractAddress, tokenId: asset?.tokenId }); }
  catch { return null; }
  if (id !== asset?.id || typeof asset?.imageUrl !== 'string' || !/^https?:\/\//u.test(asset.imageUrl)) return null;
  return { ...asset, id, contractAddress, ownerAddress };
}

export function loadLibraryAssetCache(storage, profileAddress, now = Date.now()) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!storage?.getItem || !profile) return [];
  try {
    const cached = JSON.parse(storage.getItem(libraryAssetCacheKey(profile)) || 'null');
    if (cached?.version !== CACHE_VERSION || cached.profileAddress !== profile
      || !Number.isFinite(cached.updatedAt) || now - cached.updatedAt > MAX_CACHE_AGE_MS
      || !Array.isArray(cached.assets)) return [];
    return cached.assets.slice(0, MAX_CACHED_ASSETS).map((asset) => normalizeCachedAsset(asset, profile)).filter(Boolean);
  } catch { return []; }
}

export function saveLibraryAssetCache(storage, profileAddress, assets, now = Date.now()) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!storage?.setItem || !profile) return false;
  try {
    const normalized = (Array.isArray(assets) ? assets : []).slice(0, MAX_CACHED_ASSETS)
      .map((asset) => normalizeCachedAsset(asset, profile)).filter(Boolean);
    storage.setItem(libraryAssetCacheKey(profile), JSON.stringify({ version: CACHE_VERSION,
      profileAddress: profile, updatedAt: now, assets: normalized }));
    return true;
  } catch { return false; }
}
