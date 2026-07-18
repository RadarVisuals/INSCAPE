import { normalizeProfileAddress } from '../../library/config.js';
import { assertValidProfileDocument, validateProfileDocument } from '../domain/profileDocumentValidation.js';
import { PROFILE_DOCUMENT_VERSION } from '../domain/constants.js';

export const PROFILE_SNAPSHOT_KEY_PREFIX = 'os-underneath.profile-snapshot.v1:';
export const PROFILE_PRESENTATION_KEY_PREFIX = 'os-underneath.restored-presentation.v1:';
export const profileSnapshotKey = (address) => `${PROFILE_SNAPSHOT_KEY_PREFIX}${normalizeProfileAddress(address) || 'invalid'}`;
export const profilePresentationKey = (address) => `${PROFILE_PRESENTATION_KEY_PREFIX}${normalizeProfileAddress(address) || 'invalid'}`;

export function saveProfileSnapshot(storage, document) {
  try { const value = assertValidProfileDocument(document); storage?.setItem(profileSnapshotKey(value.profile.address), JSON.stringify(value)); return true; } catch { return false; }
}
export function loadProfileSnapshot(storage, address) {
  try {
    const input = JSON.parse(storage?.getItem(profileSnapshotKey(address)) || 'null');
    const result = validateProfileDocument(input);
    return result.valid && result.value.profile.address === normalizeProfileAddress(address) ? result.value : null;
  } catch { return null; }
}
export function loadRestoredPresentation(storage, address) {
  try {
    const input = JSON.parse(storage?.getItem(profilePresentationKey(address)) || 'null');
    return input?.version === PROFILE_DOCUMENT_VERSION && ['abyssal_eye', 'skull_reaper'].includes(input.keeperId) && typeof input.stageId === 'string' ? input : null;
  } catch { return null; }
}
