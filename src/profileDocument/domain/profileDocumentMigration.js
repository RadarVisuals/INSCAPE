import { PROFILE_DOCUMENT_TYPE, PROFILE_DOCUMENT_VERSION } from './constants.js';
import { assertValidProfileDocument, ProfileDocumentValidationError } from './profileDocumentValidation.js';

export function migrateProfileDocument(input) {
  if (!input || input.documentType !== PROFILE_DOCUMENT_TYPE) throw new ProfileDocumentValidationError([{ path: 'documentType', code: 'wrong_document_type', message: 'Not an OS_UNDERNEATH profile document' }]);
  if (input.version === 1) {
    const migrated = structuredClone(input); migrated.version = 2;
    migrated.presentation.systemModules = migrated.presentation.systemModules.map((module) => ({ ...module, startOpen: false, windowGeometry: null }));
    migrated.spaces = migrated.spaces.map((space) => ({ ...space, startOpen: false, windowGeometry: null }));
    migrated.presentation.environment = { type: 'illustrated', shaderId: 'neural-field' };
    migrated.canvasObjects = [];
    migrated.version = PROFILE_DOCUMENT_VERSION;
    return assertValidProfileDocument(migrated);
  }
  if (input.version === 2) {
    const migrated = structuredClone(input); migrated.version = PROFILE_DOCUMENT_VERSION;
    migrated.presentation.environment = { type: 'illustrated', shaderId: 'neural-field' };
    migrated.canvasObjects = [];
    return assertValidProfileDocument(migrated);
  }
  if (input.version === 3) {
    const migrated = structuredClone(input); migrated.version = PROFILE_DOCUMENT_VERSION; migrated.canvasObjects = [];
    return assertValidProfileDocument(migrated);
  }
  if (input.version !== PROFILE_DOCUMENT_VERSION) throw new ProfileDocumentValidationError([{ path: 'version', code: 'unsupported_version', message: `Unsupported profile document version: ${String(input.version)}` }]);
  return assertValidProfileDocument(input);
}
