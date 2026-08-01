import { normalizeProfileAddress } from '../../library/config.js';
import { assertValidProfileDocument } from '../domain/profileDocumentValidation.js';
import { migrateProfileDocument } from '../domain/profileDocumentMigration.js';
import { PROFILE_DOCUMENT_PUBLICATION_VERSION } from '../domain/constants.js';

export const PROFILE_SNAPSHOT_KEY_PREFIX = 'os-underneath.profile-snapshot.v1:';
export const profileSnapshotKey = (address) => `${PROFILE_SNAPSHOT_KEY_PREFIX}${normalizeProfileAddress(address) || 'invalid'}`;
export { PROFILE_PRESENTATION_KEY_PREFIX, loadRestoredPresentation, profilePresentationKey, saveRestoredPresentation } from './profilePresentationStorage.js';

function assertLegacySnapshotVersion(document) {
  if (document?.version !== PROFILE_DOCUMENT_PUBLICATION_VERSION) {
    throw new TypeError(`Profile document version ${String(document?.version)} is not supported by legacy snapshot storage`);
  }
  return document;
}

export function saveProfileSnapshot(storage, document) {
  try {
    const value = assertValidProfileDocument(document);
    assertLegacySnapshotVersion(value);
    storage?.setItem(profileSnapshotKey(value.profile.address), JSON.stringify(value));
    return true;
  } catch { return false; }
}
export function loadProfileSnapshot(storage, address) {
  try {
    const input = JSON.parse(storage?.getItem(profileSnapshotKey(address)) || 'null');
    const value = migrateProfileDocument(input);
    assertLegacySnapshotVersion(value);
    return value.profile.address === normalizeProfileAddress(address) ? value : null;
  } catch { return null; }
}
