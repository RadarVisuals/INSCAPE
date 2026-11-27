import { normalizeProfileAddress } from '../../library/config.js';

const DIRECT_LEVELS = new Set(['contract', 'token', 'contract-and-token']);
const COLLECTION_LEVELS = new Set(['contract']);

function includesProfile(entries, profile) {
  return (entries || []).some((entry) => normalizeProfileAddress(entry?.address) === profile);
}

export function creatorRelationshipForProfile(asset, profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile) return null;
  if (asset?.viewedProfileIsCreator === true
    && DIRECT_LEVELS.has(asset?.creatorAttributionLevel)
    && includesProfile(asset?.creators, profile)) return 'direct';
  if (asset?.viewedProfileIsCollectionCreator === true
    && COLLECTION_LEVELS.has(asset?.collectionCreatorAttributionLevel)
    && includesProfile(asset?.collectionCreators, profile)) return 'collection';
  return null;
}

export function isCreatorRelatedAsset(asset, profileAddress) {
  return creatorRelationshipForProfile(asset, profileAddress) !== null;
}
