import { PROFILE_DOCUMENT_VERSION_8 } from '../domain/constants.js';

export const PUBLISHED_PROFILE_RUNTIME = Object.freeze({ LEGACY: 'LEGACY', LATTICE: 'LATTICE' });

export function selectPublishedProfileRuntime(document) {
  return document?.version === PROFILE_DOCUMENT_VERSION_8 && document?.lattice
    ? PUBLISHED_PROFILE_RUNTIME.LATTICE
    : PUBLISHED_PROFILE_RUNTIME.LEGACY;
}
