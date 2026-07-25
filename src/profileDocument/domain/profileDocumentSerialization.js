import { assertValidProfileDocument } from './profileDocumentValidation.js';

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
  return profileDocumentContentFingerprint(value);
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
