import { normalizeProfileAddress } from '../../library/config.js';

export const OWNER_PUBLICATION_BASELINE_VERSION = 1;
export const OWNER_PUBLICATION_BASELINE_KEY_PREFIX = 'inscape.owner-publication-baseline.v1:';

export function ownerPublicationBaselineKey(profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile) throw new TypeError('A valid profile address is required');
  return `${OWNER_PUBLICATION_BASELINE_KEY_PREFIX}${profile}`;
}

export function loadOwnerPublicationBaseline(storage, profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile || !storage?.getItem) return null;
  try {
    const value = JSON.parse(storage.getItem(ownerPublicationBaselineKey(profile)) || 'null');
    if (value?.version !== OWNER_PUBLICATION_BASELINE_VERSION
      || normalizeProfileAddress(value.profileAddress) !== profile
      || typeof value.publishedFingerprint !== 'string'
      || typeof value.localFingerprint !== 'string') return null;
    return value;
  } catch { return null; }
}

export function saveOwnerPublicationBaseline(storage, profileAddress, baseline) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile || !storage?.setItem) return false;
  const value = {
    version: OWNER_PUBLICATION_BASELINE_VERSION,
    profileAddress: profile,
    cid: typeof baseline?.cid === 'string' ? baseline.cid : null,
    pointerHash: typeof baseline?.pointerHash === 'string' ? baseline.pointerHash.toLowerCase() : null,
    publishedFingerprint: String(baseline?.publishedFingerprint || ''),
    localFingerprint: String(baseline?.localFingerprint || ''),
    hydratedAt: Number.isFinite(baseline?.hydratedAt) ? baseline.hydratedAt : Date.now()
  };
  if (!value.publishedFingerprint || !value.localFingerprint) return false;
  try { storage.setItem(ownerPublicationBaselineKey(profile), JSON.stringify(value)); return true; }
  catch { return false; }
}

export function publicationPointerMetadata(pointer) {
  const uri = typeof pointer?.url === 'string' ? pointer.url : '';
  return {
    cid: /^ipfs:\/\//iu.test(uri) ? uri.replace(/^ipfs:\/\//iu, '') : null,
    pointerHash: typeof pointer?.verification?.data === 'string' ? pointer.verification.data.toLowerCase() : null
  };
}
