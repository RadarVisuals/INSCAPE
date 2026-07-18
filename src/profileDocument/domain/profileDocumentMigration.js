import { PROFILE_DOCUMENT_TYPE, PROFILE_DOCUMENT_VERSION } from './constants.js';
import { assertValidProfileDocument, ProfileDocumentValidationError } from './profileDocumentValidation.js';

export function migrateProfileDocument(input) {
  if (!input || input.documentType !== PROFILE_DOCUMENT_TYPE) throw new ProfileDocumentValidationError([{ path: 'documentType', code: 'wrong_document_type', message: 'Not an OS_UNDERNEATH profile document' }]);
  if (input.version !== PROFILE_DOCUMENT_VERSION) throw new ProfileDocumentValidationError([{ path: 'version', code: 'unsupported_version', message: `Unsupported profile document version: ${String(input.version)}` }]);
  return assertValidProfileDocument(input);
}
