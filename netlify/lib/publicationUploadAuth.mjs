import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createPublicClient, hashMessage, http } from 'viem';
import { lukso } from 'viem/chains';
import { LUKSO_CHAIN_ID, LUKSO_RPC_URL, normalizeProfileAddress } from '../../src/library/config.js';
import { assertUploadPermit, uploadAuthorizationMessage, UPLOAD_AUTH_LIFETIME_MS } from '../../src/profileDocument/domain/uploadAuthorization.js';

export class UploadServiceError extends Error {
  constructor(code, message, status = 503, retryAfter = null) { super(message); Object.assign(this, { code, status, retryAfter }); }
}

export function readUploadPolicy(env = process.env) {
  const profiles = String(env.INSCAPE_UPLOAD_ALLOWED_PROFILES || '').split(/[\s,]+/u).filter(Boolean).map(normalizeProfileAddress);
  const secret = String(env.INSCAPE_UPLOAD_AUTH_SECRET || '');
  if (!profiles.length || profiles.length > 1000 || profiles.some(profile => !profile) || !/^[0-9a-f]{64}$/iu.test(secret)) {
    throw new UploadServiceError('UPLOAD_NOT_CONFIGURED', 'Profile upload access is not configured for this deployment.');
  }
  const limit = (key, fallback, max) => {
    const raw = env[key];
    const value = raw === undefined || raw === '' ? fallback : Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new UploadServiceError('UPLOAD_NOT_CONFIGURED', 'The upload limits need to be configured.');
    return value;
  };
  return { profiles: new Set(profiles), secret,
    hourlyPerProfile: limit('INSCAPE_UPLOAD_HOURLY_PER_PROFILE', 12, 100),
    monthlyUploads: limit('INSCAPE_UPLOAD_MONTHLY_LIMIT', 1000, 10_000),
    monthlyBytes: limit('INSCAPE_UPLOAD_MONTHLY_BYTES', 128 * 1024 * 1024, 512 * 1024 * 1024) };
}

export function assertUploadAdmission(policy, profile) {
  if (!policy.profiles.has(profile)) throw new UploadServiceError('UPLOAD_PROFILE_NOT_ALLOWED', 'Uploads are currently available to invited profiles only.', 403);
}

const mac = (text, secret) => createHmac('sha256', Buffer.from(secret, 'hex')).update(text).digest();
export function createUploadChallenge({ profile, hash, bytes, origin, policy, now = Date.now(), nonce = randomBytes(16).toString('hex') }) {
  assertUploadAdmission(policy, profile);
  // No permit survives the monthly quota boundary, including a replay.
  const date = new Date(now);
  const nextMonth = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  const permit = assertUploadPermit({ version: 1, profile, hash, bytes, origin, issuedAt: now,
    expiresAt: Math.min(now + UPLOAD_AUTH_LIFETIME_MS, nextMonth), nonce }, now);
  const payload = Buffer.from(JSON.stringify(permit)).toString('base64url');
  return { permit, authorization: `${payload}.${mac(payload, policy.secret).toString('base64url')}`, message: uploadAuthorizationMessage(permit) };
}

export function verifyUploadAuthorization(authorization, expected, policy, now = Date.now()) {
  try {
    if (typeof authorization !== 'string' || authorization.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/u.test(authorization)) throw Error();
    const [payload, tag] = authorization.split('.');
    const actual = Buffer.from(tag, 'base64url');
    if (!timingSafeEqual(actual, mac(payload, policy.secret))) throw Error();
    const permit = assertUploadPermit(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')), now);
    if (Object.entries(expected).some(([key, value]) => permit[key] !== value)) throw Error();
    assertUploadAdmission(policy, permit.profile);
    return permit;
  } catch (error) {
    if (error instanceof UploadServiceError) throw error;
    throw new UploadServiceError('UPLOAD_AUTH_INVALID', 'Upload authorization expired or does not match this presentation. Authorize the upload again.', 401);
  }
}

const SIGNATURE_ABI = [{ type: 'function', name: 'isValidSignature', stateMutability: 'view',
  inputs: [{ name: 'hash', type: 'bytes32' }, { name: 'signature', type: 'bytes' }], outputs: [{ type: 'bytes4' }] }];

export function createProfileSignatureVerifier({ client = createPublicClient({ chain: lukso, transport: http(LUKSO_RPC_URL, { timeout: 5000, retryCount: 0 }) }) } = {}) {
  return async (permit, signature) => {
    if (typeof signature !== 'string' || !/^0x(?:[0-9a-f]{2}){1,2048}$/iu.test(signature)) {
      throw new UploadServiceError('UPLOAD_SIGNATURE_INVALID', 'A valid profile signature is required for this upload.', 401);
    }
    try {
      const [chain, value] = await Promise.all([client.getChainId(), client.readContract({
        address: permit.profile, abi: SIGNATURE_ABI, functionName: 'isValidSignature',
        args: [hashMessage(uploadAuthorizationMessage(permit)), signature],
      })]);
      if (chain !== LUKSO_CHAIN_ID) throw new UploadServiceError('UPLOAD_AUTH_UNAVAILABLE', 'The profile verification network is unavailable.');
      if (value !== '0x1626ba7e') throw new UploadServiceError('UPLOAD_SIGNATURE_INVALID', 'The profile did not authorize this upload signature.', 401);
    } catch (error) {
      if (error instanceof UploadServiceError) throw error;
      throw new UploadServiceError('UPLOAD_AUTH_UNAVAILABLE', 'The profile signature could not be verified. Try again when the network is available.');
    }
  };
}
