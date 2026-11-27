import { keccak256 } from 'viem';
import { PROFILE_DOCUMENT_LIMITS } from '../../src/profileDocument/domain/constants.js';
import { createProfileDocumentV9Filename, isCanonicalProfileDocumentV9Bytes } from '../../src/profileDocument/domain/profileDocumentV9Serialization.js';
import { parseProfileDocumentV9Json } from '../../src/profileDocument/domain/profileDocumentV9Validation.js';
import { isValidCid } from '../../src/profileDocument/domain/cidValidation.js';
import { PUBLICATION_UPLOAD_PATH } from '../../src/profileDocument/domain/uploadAuthorization.js';
import { isLocalPublicationOrigin } from '../../src/profileDocument/domain/publicationOrigin.js';
import { FUNCTION_RESPONSE_SECURITY_HEADERS } from '../../scripts/productionSecurityPolicy.js';
import { UploadServiceError, readUploadPolicy, createUploadChallenge, verifyUploadAuthorization, createProfileSignatureVerifier } from '../lib/publicationUploadAuth.mjs';
import { publicationQuotaStore, createUploadQuota } from '../lib/publicationUploadQuota.mjs';

const PINATA_UPLOAD_URL = 'https://uploads.pinata.cloud/v3/files';
const DEFINITE_REJECTIONS = new Set([400, 401, 403, 413, 415, 422, 429]);
function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store', ...FUNCTION_RESPONSE_SECURITY_HEADERS, ...headers } });
}
function requestError(code, message, status, retryAfter) {
  return json({ error: { code, message } }, status, retryAfter ? { 'retry-after': String(retryAfter) } : {});
}
async function limitedBytes(request, limit) {
  if (Number(request.headers.get('content-length')) > limit) throw new UploadServiceError('DOCUMENT_TOO_LARGE', `Publication exceeds ${limit} bytes`, 413);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new UploadServiceError('DOCUMENT_TOO_LARGE', `Publication exceeds ${limit} bytes`, 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export function createPinProfileDocumentHandler({
  fetchImpl = fetch, getJwt = () => process.env.PINATA_JWT, getPolicy = readUploadPolicy,
  verifySignature = createProfileSignatureVerifier(), getQuotaStore = publicationQuotaStore, now = Date.now,
} = {}) {
  return async function pinProfileDocument(request) {
    if (!['POST', 'OPTIONS'].includes(request.method)) return requestError('METHOD_NOT_ALLOWED', 'Use POST to upload a publication', 405);
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    if (!origin || origin !== url.origin && !isLocalPublicationOrigin(origin)) {
      return requestError('ORIGIN_NOT_ALLOWED', 'The upload must originate from this INSCAPE deployment or its local development client', 403);
    }
    const challenge = url.pathname === `${PUBLICATION_UPLOAD_PATH}/challenge`;
    if (!challenge && url.pathname !== PUBLICATION_UPLOAD_PATH && url.pathname !== '/.netlify/functions/pin-profile-document') {
      return requestError('NOT_FOUND', 'Unknown publication endpoint', 404);
    }
    const cors = origin !== url.origin ? { 'access-control-allow-origin': origin,
      'access-control-expose-headers': 'retry-after', vary: 'Origin' } : {};
    if (request.method === 'OPTIONS') {
      const headers = (request.headers.get('access-control-request-headers') || '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
      if (request.headers.get('access-control-request-method') !== 'POST'
        || headers.some(value => !['content-type', 'x-inscape-upload-authorization', 'x-inscape-upload-signature'].includes(value))) {
        return requestError('PREFLIGHT_NOT_ALLOWED', 'This publication request is not supported.', 403);
      }
      return new Response(null, { status: 204, headers: { ...FUNCTION_RESPONSE_SECURITY_HEADERS, ...cors,
        'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type, x-inscape-upload-authorization, x-inscape-upload-signature',
        'access-control-max-age': '600', 'cache-control': 'no-store' } });
    }
    const response = await upload(request, origin, challenge);
    for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
    return response;
  };

  async function upload(request, origin, challenge) {
    if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
      return requestError('UNSUPPORTED_MEDIA_TYPE', 'Expected a canonical JSON publication', 415);
    }
    const deadline = AbortSignal.timeout(55_000);
    try {
      const requestBytes = await limitedBytes(request, challenge ? 1024 : PROFILE_DOCUMENT_LIMITS.maxJsonBytes);
      let document;
      try {
        const raw = new TextDecoder('utf-8', { fatal: true }).decode(requestBytes);
        document = challenge ? JSON.parse(raw) : parseProfileDocumentV9Json(raw);
      } catch {
        throw new UploadServiceError('INVALID_PROFILE_DOCUMENT', 'The publication request is invalid.', 422);
      }
      if (challenge) {
        if (!document || Object.keys(document).length !== 3 || !['profile', 'hash', 'bytes'].every(key => Object.hasOwn(document, key))) {
          throw new UploadServiceError('INVALID_UPLOAD_CHALLENGE', 'The upload authorization request is invalid.', 422);
        }
        const policy = getPolicy();
        if (!getJwt()) throw new UploadServiceError('UPLOAD_NOT_CONFIGURED', 'Public IPFS upload is not configured for this deployment.');
        try { return json(createUploadChallenge({ ...document, origin, policy, now: now() })); }
        catch (error) {
          if (error instanceof UploadServiceError) throw error;
          throw new UploadServiceError('INVALID_UPLOAD_CHALLENGE', 'The upload authorization request is invalid.', 422);
        }
      }
      if (!isCanonicalProfileDocumentV9Bytes(document, requestBytes)) {
        throw new UploadServiceError('NON_CANONICAL_DOCUMENT', 'Upload the exact canonical publication generated by INSCAPE', 422);
      }
      const authorization = request.headers.get('x-inscape-upload-authorization');
      const signature = request.headers.get('x-inscape-upload-signature');
      if (!authorization || !signature) throw new UploadServiceError('UPLOAD_AUTH_REQUIRED', 'Authorize this upload with your Universal Profile first.', 401);
      const policy = getPolicy();
      const jwt = getJwt();
      if (!jwt) throw new UploadServiceError('UPLOAD_NOT_CONFIGURED', 'Public IPFS upload is not configured for this deployment.');
      const permit = verifyUploadAuthorization(authorization, { origin, profile: document.profile.address,
        hash: keccak256(requestBytes), bytes: requestBytes.byteLength }, policy, now());
      await verifySignature(permit, signature);
      const quota = createUploadQuota({ store: getQuotaStore(deadline), now });
      const reservation = await quota.reserve(permit, policy);
      if (reservation.cid) return json({ cid: reservation.cid }, 200);

      const form = new FormData();
      form.append('network', 'public');
      form.append('name', createProfileDocumentV9Filename(document));
      form.append('keyvalues', JSON.stringify({ application: 'inscape', profile: document.profile.address, documentType: document.documentType }));
      form.append('file', new Blob([requestBytes], { type: 'application/json' }), createProfileDocumentV9Filename(document));
      let upstream;
      try {
        upstream = await fetchImpl(PINATA_UPLOAD_URL, { method: 'POST', headers: { authorization: `Bearer ${jwt}` }, body: form,
          signal: AbortSignal.any([deadline, AbortSignal.timeout(45_000)]) });
      } catch {
        // A timeout cannot prove that Pinata did not store the bytes. The durable
        // reservation remains, so another instance cannot submit them a second time.
        console.error('[profile-publication-upload] Upstream outcome unknown');
        throw new UploadServiceError('UPLOAD_OUTCOME_UNKNOWN', 'The upload outcome is unknown. This presentation will not be uploaded again automatically.', 502);
      }
      if (!upstream.ok) {
        console.error('[profile-publication-upload] Upstream rejected request', { status: upstream.status });
        if (DEFINITE_REJECTIONS.has(upstream.status)) {
          try { await quota.finish(reservation, {}); } catch { /* Keep the reservation if accounting cannot be confirmed. */ }
          throw new UploadServiceError('IPFS_UPLOAD_REJECTED', 'The upload was rejected. Check the service configuration before authorizing a new attempt.', 502);
        }
        throw new UploadServiceError('UPLOAD_OUTCOME_UNKNOWN', 'The upload service returned an uncertain result. Check the previous upload before trying another presentation.', 502);
      }
      let payload;
      try { payload = await upstream.json(); } catch { payload = null; }
      const cid = payload?.data?.cid;
      if (typeof cid !== 'string' || !isValidCid(cid)) {
        throw new UploadServiceError('UPLOAD_OUTCOME_UNKNOWN', 'The upload service returned no valid CID. Check the previous upload before trying another presentation.', 502);
      }
      try { await quota.finish(reservation, { cid }); }
      catch { throw new UploadServiceError('UPLOAD_OUTCOME_UNKNOWN', 'The upload completed, but its result could not be saved. Check the previous upload before trying another presentation.', 503); }
      return json({ cid }, 201);
    } catch (error) {
      if (error instanceof UploadServiceError) return requestError(error.code, error.message, error.status, error.retryAfter);
      console.error('[profile-publication-upload] Service unavailable');
      return requestError('UPLOAD_UNAVAILABLE', 'The upload service is unavailable. No new request should be retried automatically.', 503);
    }
  }
}

export default createPinProfileDocumentHandler();
export const config = {
  path: ['/api/profile-publications', '/api/profile-publications/challenge'], method: ['POST', 'OPTIONS'],
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 3600, windowLimit: 36 },
};
