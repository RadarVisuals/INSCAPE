import { PROFILE_DOCUMENT_TYPE, PROFILE_DOCUMENT_VERSION, PROFILE_DOCUMENT_VERSION_8 } from './constants.js';
import { assertValidProfileDocument, ProfileDocumentValidationError } from './profileDocumentValidation.js';

const addHomeShortcut = (spaces) => (Array.isArray(spaces) ? spaces : []).map((space) => ({ ...space, homeShortcut: true }));
const addAvatarShape = (document) => {
  document.presentation.avatarShape = 'square';
  return document;
};
const addVisitorNavigation = (document) => {
  document.presentation.visitorNavigation = { showCategories: true, showCreations: false };
  return document;
};
const finishLegacyMigration = (document, { avatarShape = false } = {}) => {
  if (avatarShape) addAvatarShape(document);
  addVisitorNavigation(document);
  return assertValidProfileDocument(document);
};

export function migrateProfileDocument(input) {
  if (!input || input.documentType !== PROFILE_DOCUMENT_TYPE) throw new ProfileDocumentValidationError([{ path: 'documentType', code: 'wrong_document_type', message: 'Not an OS_UNDERNEATH profile document' }]);
  if (input.version === 1) {
    const migrated = structuredClone(input); migrated.version = 2;
    migrated.presentation.systemModules = migrated.presentation.systemModules.map((module) => ({ ...module, startOpen: false, windowGeometry: null }));
    migrated.spaces = migrated.spaces.map((space) => ({ ...space, startOpen: false, windowGeometry: null, homeShortcut: true }));
    migrated.presentation.environment = { type: 'illustrated', shaderId: 'neural-field' };
    migrated.canvasObjects = [];
    migrated.version = PROFILE_DOCUMENT_VERSION;
    return finishLegacyMigration(migrated, { avatarShape: true });
  }
  if (input.version === 2) {
    const migrated = structuredClone(input); migrated.version = PROFILE_DOCUMENT_VERSION;
    migrated.presentation.environment = { type: 'illustrated', shaderId: 'neural-field' };
    migrated.canvasObjects = [];
    migrated.spaces = addHomeShortcut(migrated.spaces);
    return finishLegacyMigration(migrated, { avatarShape: true });
  }
  if (input.version === 3) {
    const migrated = structuredClone(input); migrated.version = PROFILE_DOCUMENT_VERSION; migrated.canvasObjects = [];
    migrated.spaces = addHomeShortcut(migrated.spaces);
    return finishLegacyMigration(migrated, { avatarShape: true });
  }
  if (input.version === 4) {
    const migrated = structuredClone(input); migrated.version = PROFILE_DOCUMENT_VERSION;
    migrated.spaces = addHomeShortcut(migrated.spaces);
    return finishLegacyMigration(migrated, { avatarShape: true });
  }
  if (input.version === 5) {
    const migrated = structuredClone(input); migrated.version = PROFILE_DOCUMENT_VERSION;
    return finishLegacyMigration(migrated, { avatarShape: true });
  }
  if (input.version === 6) {
    const migrated = structuredClone(input); migrated.version = PROFILE_DOCUMENT_VERSION;
    return finishLegacyMigration(migrated);
  }
  if (![PROFILE_DOCUMENT_VERSION, PROFILE_DOCUMENT_VERSION_8].includes(input.version)) throw new ProfileDocumentValidationError([{ path: 'version', code: 'unsupported_version', message: `Unsupported profile document version: ${String(input.version)}` }]);
  return assertValidProfileDocument(input);
}
