import { normalizeProfileAddress } from '../library/config.js';

const LEGACY_OWNER_SUFFIX = ':legacy-owner';

export function ownerProfileStorageKey(baseKey, profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  return profile ? `${baseKey}:${profile}` : null;
}

export function readOwnerProfileValue(storage, baseKey, profileAddress, legacyKeys = [baseKey]) {
  const profile = normalizeProfileAddress(profileAddress);
  const scopedKey = ownerProfileStorageKey(baseKey, profile);
  if (!storage?.getItem || !scopedKey) return null;
  try {
    const scoped = storage.getItem(scopedKey);
    if (scoped !== null) return scoped;

    const ownerKey = `${baseKey}${LEGACY_OWNER_SUFFIX}`;
    const legacyOwner = normalizeProfileAddress(storage.getItem(ownerKey));
    if (legacyOwner && legacyOwner !== profile) return null;

    for (const legacyKey of legacyKeys) {
      const legacy = storage.getItem(legacyKey);
      if (legacy === null) continue;
      storage.setItem(scopedKey, legacy);
      storage.setItem(ownerKey, profile);
      for (const retiredKey of legacyKeys) storage.removeItem?.(retiredKey);
      return legacy;
    }
  } catch {
    return null;
  }
  return null;
}

export function writeOwnerProfileValue(storage, baseKey, profileAddress, value) {
  const key = ownerProfileStorageKey(baseKey, profileAddress);
  if (!storage?.setItem || !key) return false;
  try { storage.setItem(key, value); return true; } catch { return false; }
}

export function removeOwnerProfileValue(storage, baseKey, profileAddress) {
  const key = ownerProfileStorageKey(baseKey, profileAddress);
  if (!storage?.removeItem || !key) return false;
  try { storage.removeItem(key); return true; } catch { return false; }
}
