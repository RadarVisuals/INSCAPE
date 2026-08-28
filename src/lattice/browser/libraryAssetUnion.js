import { normalizeProfileAddress } from '../../library/config.js';
import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';
import { creatorRelationshipForProfile } from '../../creations/domain/creatorRelationship.js';
import { adaptLatticeProductionBrowserAsset } from './latticeProductionBrowserAdapter.js';

const present = (value) => value !== null && value !== undefined && value !== '';

function mergeUnique(left, right, key) {
  return [...new Map([...(left || []), ...(right || [])].filter(Boolean).map((entry) => [key(entry), entry])).values()];
}

export function isStrongCreatedAsset(asset, profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile || !creatorRelationshipForProfile(asset, profile)) return false;
  if (!parseCanonicalAssetId(asset?.id)) return false;
  return true;
}

export function mergeOwnedAndCreatedAsset(owned, created, profileAddress) {
  if (!owned || !created || owned.id !== created.id || !isStrongCreatedAsset(created, profileAddress)) return owned || created || null;
  const merged = { ...created, ...owned };
  for (const field of ['name', 'description', 'collectionName', 'thumbnailUrl', 'imageUrl', 'originalImageUrl',
    'imageWidth', 'imageHeight', 'mediaFileType', 'tokenType']) {
    if (!present(merged[field]) && present(created[field])) merged[field] = created[field];
  }
  merged.creators = mergeUnique(owned.creators, created.creators, (creator) => normalizeProfileAddress(creator?.address) || JSON.stringify(creator));
  merged.attributes = mergeUnique(owned.attributes, created.attributes, (attribute) => `${attribute?.key}\n${attribute?.value}\n${attribute?.type}`);
  merged.imageGroups = mergeUnique(owned.imageGroups, created.imageGroups, (group) => `${group?.index}\n${group?.imageUrl}`)
    .sort((left, right) => Number(left?.index) - Number(right?.index));
  merged.viewedProfileIsCreator = created.viewedProfileIsCreator === true;
  merged.creatorAttributionLevel = created.creatorAttributionLevel || null;
  merged.viewedProfileIsCollectionCreator = created.viewedProfileIsCollectionCreator === true;
  merged.collectionCreatorAttributionLevel = created.collectionCreatorAttributionLevel || null;
  merged.collectionCreators = mergeUnique(owned.collectionCreators, created.collectionCreators,
    (creator) => normalizeProfileAddress(creator?.address) || JSON.stringify(creator));
  merged.ownershipKnown = true;
  merged.isOwnedByViewedProfile = true;
  merged.ownerAddress = normalizeProfileAddress(owned.ownerAddress);
  merged.currentOwnerAddress = normalizeProfileAddress(owned.ownerAddress);
  merged.fieldProvenance = {
    ...(created.fieldProvenance || {}), ...(owned.fieldProvenance || {}),
    creators: owned.fieldProvenance?.creators || { scope: created.creatorAttributionLevel, source: 'INDEXED CREATOR ATTRIBUTION' },
  };
  merged.rawMetadata = { ...(created.rawMetadata || {}), ...(owned.rawMetadata || {}) };
  return merged;
}

function createdBrowserAsset(asset, profileAddress) {
  if (!isStrongCreatedAsset(asset, profileAddress)) return null;
  const projected = adaptLatticeProductionBrowserAsset(asset, profileAddress, true);
  return projected ? { ...projected, assetRecord: asset, created: true, owned: false,
    creatorRelationship: creatorRelationshipForProfile(asset, profileAddress),
    currentOwnerAddress: asset.currentOwnerAddress ?? null, isOwnedByViewedProfile: false } : null;
}

export function projectLibraryAssetUnion({ createdAssets = [], ownedAssets = [], profileAddress } = {}) {
  const profile = normalizeProfileAddress(profileAddress);
  const ownedById = new Map();
  for (const asset of ownedAssets || []) {
    const projected = adaptLatticeProductionBrowserAsset(asset, profile);
    if (projected && !ownedById.has(projected.stableAssetId)) ownedById.set(projected.stableAssetId, asset);
  }
  const createdById = new Map();
  for (const asset of createdAssets || []) {
    if (isStrongCreatedAsset(asset, profile) && !createdById.has(asset.id)) createdById.set(asset.id, asset);
  }
  const ids = [...new Set([...ownedById.keys(), ...createdById.keys()])];
  const records = ids.map((id) => {
    const owned = ownedById.get(id); const created = createdById.get(id);
    if (owned && !created) return { ...owned, ownershipKnown: true, isOwnedByViewedProfile: true,
      currentOwnerAddress: normalizeProfileAddress(owned.ownerAddress) };
    return mergeOwnedAndCreatedAsset(owned, created, profile);
  }).filter(Boolean);
  const assets = records.map((record) => {
    const owned = ownedById.has(record.id); const created = createdById.has(record.id);
    const projected = owned ? adaptLatticeProductionBrowserAsset(record, profile) : createdBrowserAsset(record, profile);
    return projected ? { ...projected, assetRecord: record, created, owned,
      creatorRelationship: created ? creatorRelationshipForProfile(record, profile) : null,
      currentOwnerAddress: record.currentOwnerAddress ?? null, isOwnedByViewedProfile: owned } : null;
  }).filter(Boolean);
  return { assets, records };
}
