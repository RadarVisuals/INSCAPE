import { normalizeProfileAddress } from '../../library/config.js';
import { assertValidProfileDocument } from '../domain/profileDocumentValidation.js';
import { migrateProfileDocument } from '../domain/profileDocumentMigration.js';

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
    const value = migrateProfileDocument(input);
    return value.profile.address === normalizeProfileAddress(address) ? value : null;
  } catch { return null; }
}
export function loadRestoredPresentation(storage, address) {
  try {
    const input = JSON.parse(storage?.getItem(profilePresentationKey(address)) || 'null');
    if (!['abyssal_eye', 'skull_reaper'].includes(input?.keeperId) || typeof input?.stageId !== 'string') return null;
    if (input.version === 1) return { ...input, environment: { type: 'illustrated', shaderId: 'neural-field' } };
    if (input.version !== 2 || !['illustrated', 'shader'].includes(input.environment?.type) || input.environment?.shaderId !== 'neural-field') return null;
    return input;
  } catch { return null; }
}

export function saveRestoredPresentation(storage, address, presentation) {
  const profileAddress = normalizeProfileAddress(address);
  const value = {
    version: 2,
    keeperId: presentation?.keeperId,
    stageId: presentation?.stageId,
    environment: presentation?.environment
  };
  if (!profileAddress || !['abyssal_eye', 'skull_reaper'].includes(value.keeperId) || typeof value.stageId !== 'string'
    || !['illustrated', 'shader'].includes(value.environment?.type) || value.environment?.shaderId !== 'neural-field') return false;
  if (!storage?.setItem) return false;
  try { storage.setItem(profilePresentationKey(profileAddress), JSON.stringify(value)); return true; } catch { return false; }
}
