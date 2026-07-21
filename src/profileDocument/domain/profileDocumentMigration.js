import { PROFILE_DOCUMENT_TYPE, PROFILE_DOCUMENT_VERSION } from './constants.js';
import { assertValidProfileDocument, ProfileDocumentValidationError } from './profileDocumentValidation.js';
import { createDefaultIdentityRack } from './profileDocumentRacks.js';

function migrateV4ToV5(input) {
  const migrated = structuredClone(input);
  const legacyIdentity = migrated.presentation?.systemModules?.find((module) => module.id === 'identity');
  const profileIsPublished = legacyIdentity?.visible !== false;
  migrated.version = PROFILE_DOCUMENT_VERSION;
  migrated.presentation.racks = [createDefaultIdentityRack({
    visible: profileIsPublished,
    profileStartOpen: legacyIdentity?.startOpen === true
  })];
  const cached = migrated.profile?.cachedIdentity || {};
  migrated.profile.cachedIdentity = {
    address: migrated.profile.address,
    ...(profileIsPublished && typeof cached.name === 'string' ? { name: cached.name } : {}),
    ...(profileIsPublished && typeof cached.avatarUrl === 'string' ? { avatarUrl: cached.avatarUrl } : {})
  };
  return assertValidProfileDocument(migrated);
}

export function migrateProfileDocument(input) {
  if (!input || input.documentType !== PROFILE_DOCUMENT_TYPE) throw new ProfileDocumentValidationError([{ path: 'documentType', code: 'wrong_document_type', message: 'Not an OS_UNDERNEATH profile document' }]);
  if (input.version === 1) {
    const migrated = structuredClone(input); migrated.version = 2;
    migrated.presentation.systemModules = migrated.presentation.systemModules.map((module) => ({ ...module, startOpen: false, windowGeometry: null }));
    migrated.spaces = migrated.spaces.map((space) => ({ ...space, startOpen: false, windowGeometry: null }));
    migrated.presentation.environment = { type: 'illustrated', shaderId: 'neural-field' };
    migrated.canvasObjects = [];
    migrated.version = 4;
    return migrateV4ToV5(migrated);
  }
  if (input.version === 2) {
    const migrated = structuredClone(input); migrated.version = 4;
    migrated.presentation.environment = { type: 'illustrated', shaderId: 'neural-field' };
    migrated.canvasObjects = [];
    return migrateV4ToV5(migrated);
  }
  if (input.version === 3) {
    const migrated = structuredClone(input); migrated.version = 4; migrated.canvasObjects = [];
    return migrateV4ToV5(migrated);
  }
  if (input.version === 4) return migrateV4ToV5(input);
  if (input.version !== PROFILE_DOCUMENT_VERSION) throw new ProfileDocumentValidationError([{ path: 'version', code: 'unsupported_version', message: `Unsupported profile document version: ${String(input.version)}` }]);
  return assertValidProfileDocument(input);
}
