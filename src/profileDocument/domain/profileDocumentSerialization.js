import { assertValidProfileDocument } from './profileDocumentValidation.js';
import { PROFILE_DOCUMENT_VERSION, PROFILE_DOCUMENT_VERSION_8 } from './constants.js';
import { latticeProductionDraftReconciliationValue, latticeProductionPublicationReconciliationValue } from '../../lattice/domain/latticeProductionReconciliationFingerprint.js';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonicalize(value[key])]));
}
export function canonicalSerializeProfileDocument(document) { return JSON.stringify(canonicalize(assertValidProfileDocument(document))); }
export function formatProfileDocumentJson(document) { return JSON.stringify(canonicalize(assertValidProfileDocument(document)), null, 2); }
export function profileDocumentContentFingerprint(document) {
  const value = assertValidProfileDocument(document);
  const { revision: _revision, createdAt: _createdAt, exportedAt: _exportedAt, ...content } = value;
  return JSON.stringify(canonicalize(content));
}
export function profileDocumentReconciliationFingerprint(document) {
  const value = structuredClone(assertValidProfileDocument(document));
  value.profile.cachedIdentity = { address: value.profile.address };
  if (value.version === PROFILE_DOCUMENT_VERSION_8) value.lattice = latticeProductionPublicationReconciliationValue(value.lattice);
  const { revision: _revision, createdAt: _createdAt, exportedAt: _exportedAt, ...content } = value;
  return JSON.stringify(canonicalize(content));
}
export function ownerProfileDocumentReconciliationFingerprint(compatibilityDocument, latticeDraft) {
  const value = structuredClone(assertValidProfileDocument(compatibilityDocument));
  if (value.version !== PROFILE_DOCUMENT_VERSION) throw new TypeError('The owner compatibility projection must remain version 7');
  value.version = PROFILE_DOCUMENT_VERSION_8;
  value.profile.cachedIdentity = { address: value.profile.address };
  value.lattice = latticeProductionDraftReconciliationValue(latticeDraft);
  const { revision: _revision, createdAt: _createdAt, exportedAt: _exportedAt, ...content } = value;
  return JSON.stringify(canonicalize(content));
}
export function createProfileDocumentFilename(document) {
  assertValidProfileDocument(document);
  const name = document.profile.cachedIdentity?.name || 'profile';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || document.profile.address.slice(2, 10);
  return `os-underneath-${slug}-profile-v${document.version}.json`;
}
export function createProfileDocumentPublicationFilename(document) {
  return createProfileDocumentFilename(document).replace(/\.json$/u, '-publication.json');
}
