import { keccak256 } from 'viem';
import { assertValidProfileDocumentV9 } from './profileDocumentV9Validation.js';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

export function canonicalSerializeProfileDocumentV9(document) {
  return JSON.stringify(canonicalize(assertValidProfileDocumentV9(document)));
}

export function formatProfileDocumentV9Json(document) {
  return JSON.stringify(canonicalize(assertValidProfileDocumentV9(document)), null, 2);
}

export function profileDocumentV9HashInput(document) {
  return new TextEncoder().encode(canonicalSerializeProfileDocumentV9(document));
}

export function isCanonicalProfileDocumentV9Bytes(document, bytes) {
  if (!(bytes instanceof Uint8Array)) return false;
  const canonicalBytes = profileDocumentV9HashInput(document);
  if (canonicalBytes.byteLength !== bytes.byteLength) return false;
  return canonicalBytes.every((byte, index) => byte === bytes[index]);
}

export function profileDocumentV9CanonicalHash(document) {
  return keccak256(profileDocumentV9HashInput(document));
}

export function profileDocumentV9ContentFingerprint(document) {
  const value = assertValidProfileDocumentV9(document);
  const { revision: _revision, createdAt: _createdAt, exportedAt: _exportedAt, ...content } = value;
  return JSON.stringify(canonicalize(content));
}

export function profileDocumentV9ReconciliationFingerprint(document) {
  const value = structuredClone(assertValidProfileDocumentV9(document));
  value.profile.cachedIdentity = { address: value.profile.address };
  const { revision: _revision, createdAt: _createdAt, exportedAt: _exportedAt, ...content } = value;
  return JSON.stringify(canonicalize(content));
}

export function createProfileDocumentV9Filename(document) {
  const value = assertValidProfileDocumentV9(document);
  const name = value.profile.cachedIdentity.name || 'profile';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '').slice(0, 40)
    || value.profile.address.slice(2, 10);
  return `inscape-${slug}-profile-v9.json`;
}
