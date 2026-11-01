import { createSiweMessage } from 'viem/siwe';
import { LUKSO_CHAIN_ID, normalizeProfileAddress } from '../../library/config.js';
import { PROFILE_DOCUMENT_LIMITS } from './constants.js';

export const PUBLICATION_UPLOAD_PATH = '/api/profile-publications';
export const UPLOAD_AUTH_LIFETIME_MS = 5 * 60_000;
const PERMIT_KEYS = ['version', 'profile', 'hash', 'bytes', 'origin', 'issuedAt', 'expiresAt', 'nonce'];

export function assertUploadPermit(permit, now = Date.now()) {
  if (!permit || Object.keys(permit).length !== PERMIT_KEYS.length || PERMIT_KEYS.some(key => !Object.hasOwn(permit, key))
    || permit.version !== 1 || !normalizeProfileAddress(permit.profile) || permit.profile !== normalizeProfileAddress(permit.profile)
    || typeof permit.hash !== 'string' || !/^0x[0-9a-f]{64}$/u.test(permit.hash)
    || typeof permit.nonce !== 'string' || !/^[0-9a-f]{32}$/u.test(permit.nonce)
    || !Number.isSafeInteger(permit.bytes) || permit.bytes < 1 || permit.bytes > PROFILE_DOCUMENT_LIMITS.maxJsonBytes
    || !Number.isSafeInteger(permit.issuedAt) || !Number.isSafeInteger(permit.expiresAt)
    || permit.issuedAt > now + 30_000 || permit.expiresAt <= now || permit.expiresAt <= permit.issuedAt
    || permit.expiresAt - permit.issuedAt > UPLOAD_AUTH_LIFETIME_MS) throw new Error('Invalid or expired upload authorization');
  const origin = new URL(permit.origin);
  if (origin.origin !== permit.origin || !['https:', 'http:'].includes(origin.protocol)
    || (origin.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))) {
    throw new Error('Invalid upload origin');
  }
  return permit;
}

export function uploadAuthorizationMessage(permit) {
  return createSiweMessage({
    domain: new URL(permit.origin).host, address: permit.profile, version: '1', chainId: LUKSO_CHAIN_ID,
    statement: `Authorize INSCAPE to upload this public presentation (${permit.bytes} bytes). Publishing to my profile requires a separate transaction.`,
    uri: new URL(PUBLICATION_UPLOAD_PATH, permit.origin).href, nonce: permit.nonce,
    issuedAt: new Date(permit.issuedAt), expirationTime: new Date(permit.expiresAt),
    resources: [`urn:inscape:publication:${permit.hash}`],
  });
}
