import { normalizeProfileAddress } from '../library/config.js';
import {
  decodeModuleLayout,
  encodeModuleLayout,
  getDefaultModulePositions,
  LEGACY_MODULE_LAYOUT_STORAGE_KEY,
  MODULE_LAYOUT_STORAGE_KEY,
  normalizeModulePositions
} from './moduleLayout.js';

export const PROFILE_MODULE_LAYOUT_KEY_PREFIX = 'human-underneath.module-grid.profile.v1:';
export const PROFILE_SYSTEM_PRESENTATION_KEY_PREFIX = 'os-underneath.system-launchers.v2:';
export const LEGACY_SYSTEM_PRESENTATION_KEY = 'os-underneath.system-launchers.v1';
export const OWNER_LAYOUT_LEGACY_CLAIM_KEY = 'os-underneath.owner-layout-legacy-claim.v1';

export const profileModuleLayoutKey = (address) => `${PROFILE_MODULE_LAYOUT_KEY_PREFIX}${normalizeProfileAddress(address) || 'invalid'}`;
export const profileSystemPresentationKey = (address) => `${PROFILE_SYSTEM_PRESENTATION_KEY_PREFIX}${normalizeProfileAddress(address) || 'invalid'}`;

function legacyRecordsBelongToProfile(storage, address) {
  const profileAddress = normalizeProfileAddress(address);
  if (!profileAddress || !storage?.getItem || !storage?.setItem) return false;
  try {
    const claim = JSON.parse(storage.getItem(OWNER_LAYOUT_LEGACY_CLAIM_KEY) || 'null');
    if (claim?.version === 1 && normalizeProfileAddress(claim.profileAddress)) return normalizeProfileAddress(claim.profileAddress) === profileAddress;
    storage.setItem(OWNER_LAYOUT_LEGACY_CLAIM_KEY, JSON.stringify({ version: 1, profileAddress }));
    return true;
  } catch { return false; }
}

export function loadClaimedLegacyLayoutValue(storage, address, key) {
  if (typeof key !== 'string' || !key || !legacyRecordsBelongToProfile(storage, address)) return null;
  try { return storage.getItem(key); } catch { return null; }
}

export function loadProfileModulePositions(storage, address, geometry) {
  const profileAddress = normalizeProfileAddress(address);
  if (!profileAddress || !storage?.getItem) return getDefaultModulePositions(geometry);
  try {
    const scoped = storage.getItem(profileModuleLayoutKey(profileAddress));
    if (scoped) return decodeModuleLayout(scoped, geometry);
    if (!legacyRecordsBelongToProfile(storage, profileAddress)) return getDefaultModulePositions(geometry);
    const current = storage.getItem(MODULE_LAYOUT_STORAGE_KEY);
    let positions = current ? decodeModuleLayout(current, geometry) : null;
    if (!current) {
      const legacy = JSON.parse(storage.getItem(LEGACY_MODULE_LAYOUT_STORAGE_KEY) || 'null');
      positions = legacy?.version === 3 ? normalizeModulePositions(legacy.positions, geometry) : null;
    }
    if (!positions) return getDefaultModulePositions(geometry);
    saveProfileModulePositions(storage, profileAddress, positions);
    return positions;
  } catch { return getDefaultModulePositions(geometry); }
}

export function saveProfileModulePositions(storage, address, positions) {
  const profileAddress = normalizeProfileAddress(address);
  if (!profileAddress || !storage?.setItem) return false;
  try { storage.setItem(profileModuleLayoutKey(profileAddress), encodeModuleLayout(positions)); return true; } catch { return false; }
}

export function removeProfileModulePositions(storage, address) {
  const profileAddress = normalizeProfileAddress(address);
  if (!profileAddress || !storage?.removeItem) return false;
  try { storage.removeItem(profileModuleLayoutKey(profileAddress)); return true; } catch { return false; }
}

export function loadProfileSystemPresentation(storage, address) {
  const profileAddress = normalizeProfileAddress(address);
  if (!profileAddress || !storage?.getItem) return null;
  try {
    const scoped = storage.getItem(profileSystemPresentationKey(profileAddress));
    if (scoped) return JSON.parse(scoped);
    if (!legacyRecordsBelongToProfile(storage, profileAddress)) return null;
    const legacy = JSON.parse(storage.getItem(LEGACY_SYSTEM_PRESENTATION_KEY) || 'null');
    if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return null;
    saveProfileSystemPresentation(storage, profileAddress, legacy);
    return legacy;
  } catch { return null; }
}

export function saveProfileSystemPresentation(storage, address, presentation) {
  const profileAddress = normalizeProfileAddress(address);
  if (!profileAddress || !storage?.setItem || !presentation || typeof presentation !== 'object' || Array.isArray(presentation)) return false;
  try { storage.setItem(profileSystemPresentationKey(profileAddress), JSON.stringify(presentation)); return true; } catch { return false; }
}
