import { assertPublicationContext, createCanonicalPublication, normalizeProfileDocumentCid } from '../domain/profileDocumentPublication.js';
import { assertValidProfileDocumentV9 } from '../domain/profileDocumentV9Validation.js';
import { assertUploadPermit, uploadAuthorizationMessage, PUBLICATION_UPLOAD_PATH } from '../domain/uploadAuthorization.js';

const DEFAULT_UPLOAD_ENDPOINT = PUBLICATION_UPLOAD_PATH;
const DEFAULT_UPLOAD_TIMEOUT_MS = 50_000;

export class ProfileDocumentUploadError extends Error {
  constructor(message, code = 'UPLOAD_FAILED') {
    super(message);
    this.name = 'ProfileDocumentUploadError';
    this.code = code;
  }
}

async function requestJson(endpoint, init, { fetchImpl, timeoutMs, signal }) {
  let response;
  try {
    response = await fetchImpl(endpoint, {
      ...init, method: 'POST',
      signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)].filter(Boolean)),
    });
  } catch (error) {
    if (signal?.aborted) throw new ProfileDocumentUploadError('The upload request was cancelled.', 'UPLOAD_CANCELLED');
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new ProfileDocumentUploadError('The upload service timed out. It may have received the presentation; check the previous result before authorizing another upload.', 'UPLOAD_TIMEOUT');
    }
    throw new ProfileDocumentUploadError('The IPFS upload service could not be reached', 'UPLOAD_UNAVAILABLE');
  }

  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (response.status === 429) {
    const error = new ProfileDocumentUploadError(payload?.error?.message || 'The upload request limit has been reached. Try again later.', payload?.error?.code || 'UPLOAD_RATE_LIMITED');
    error.retryAfter = response.headers.get('retry-after');
    throw error;
  }
  if (!payload) {
    throw new ProfileDocumentUploadError(
      'The publication function is unavailable. Plain Vite cannot upload to IPFS; use Netlify Dev or the exact Deploy Preview.',
      'PUBLICATION_FUNCTION_UNAVAILABLE');
  }
  if (!response.ok) {
    throw new ProfileDocumentUploadError(payload?.error?.message || 'The IPFS upload failed', payload?.error?.code);
  }
  return payload;
}

export async function uploadProfileDocument(snapshot, {
  endpoint = DEFAULT_UPLOAD_ENDPOINT, origin = globalThis.location?.origin,
  fetchImpl = fetch, timeoutMs = DEFAULT_UPLOAD_TIMEOUT_MS, getContext, signal, onPhase = () => {}, now = Date.now,
} = {}) {
  assertValidProfileDocumentV9(snapshot);
  const artifact = createCanonicalPublication(snapshot);
  const initial = getContext?.();
  const originalWalletClient = initial?.walletClient;
  const originalProvider = initial?.provider;
  const contextKey = context => JSON.stringify([
    context?.publicationContextGeneration, context?.snapshotGeneration, context?.draftGeneration,
    context?.snapshotArtifactHash, context?.draftFingerprint, context?.viewedProfileAddress,
    context?.walletClient?.account?.address || context?.walletClient?.account,
  ]);
  const binding = contextKey(initial);
  const assertFresh = () => {
    if (signal?.aborted) throw new ProfileDocumentUploadError('The upload request was cancelled.', 'UPLOAD_CANCELLED');
    const current = getContext?.();
    try {
      assertPublicationContext(current, artifact, { requireClients: true });
      if (current.snapshotStale || current.snapshotArtifactHash !== artifact.hash
        || !Number.isSafeInteger(current.publicationContextGeneration) || !Number.isSafeInteger(current.snapshotGeneration)
        || !Number.isSafeInteger(current.draftGeneration) || current.walletClient !== originalWalletClient
        || current.provider !== originalProvider || contextKey(current) !== binding) throw Error();
    } catch { throw new ProfileDocumentUploadError('The profile, wallet or presentation changed. Prepare the publication again.', 'UPLOAD_CONTEXT_CHANGED'); }
    return current;
  };
  assertFresh();
  const target = new URL(endpoint, origin);
  if (target.origin !== origin || target.pathname !== PUBLICATION_UPLOAD_PATH || target.search || target.hash) {
    throw new ProfileDocumentUploadError('Upload authorization must use this INSCAPE deployment.', 'UPLOAD_ORIGIN_INVALID');
  }
  const options = { fetchImpl, timeoutMs, signal };
  const challenge = await requestJson(`${target.href}/challenge`, {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ profile: artifact.document.profile.address, hash: artifact.hash, bytes: artifact.bytes.byteLength }),
  }, options);
  assertFresh();
  try {
    const permit = assertUploadPermit(challenge.permit, now());
    if (permit.profile !== artifact.document.profile.address || permit.origin !== origin || permit.hash !== artifact.hash
      || permit.bytes !== artifact.bytes.byteLength || challenge.message !== uploadAuthorizationMessage(permit)
      || typeof challenge.authorization !== 'string' || challenge.authorization.length > 2048) throw Error();
  } catch { throw new ProfileDocumentUploadError('The service returned invalid upload authorization. Nothing was signed.', 'UPLOAD_CHALLENGE_INVALID'); }
  onPhase('AUTHORIZING');
  const current = assertFresh();
  if (typeof current.walletClient.signMessage !== 'function') throw new ProfileDocumentUploadError('This wallet cannot sign upload authorization messages.', 'UPLOAD_SIGNATURE_UNAVAILABLE');
  let signature;
  try { signature = await current.walletClient.signMessage({ account: current.walletClient.account, message: challenge.message }); }
  catch { throw new ProfileDocumentUploadError('Upload authorization was not completed. Your presentation has not been uploaded.', 'UPLOAD_AUTH_NOT_COMPLETED'); }
  assertFresh();
  try { assertUploadPermit(challenge.permit, now()); }
  catch { throw new ProfileDocumentUploadError('Upload authorization expired. Authorize the upload again.', 'UPLOAD_AUTH_INVALID'); }
  if (typeof signature !== 'string' || !/^0x(?:[0-9a-f]{2}){1,2048}$/iu.test(signature)) throw new ProfileDocumentUploadError('The wallet returned no valid upload signature.', 'UPLOAD_SIGNATURE_INVALID');
  onPhase('UPLOADING');
  assertFresh();
  const payload = await requestJson(target.href, {
    headers: { 'content-type': 'application/json', 'x-inscape-upload-authorization': challenge.authorization, 'x-inscape-upload-signature': signature },
    body: artifact.text,
  }, options);
  assertFresh();

  let ipfsUri;
  try { ipfsUri = normalizeProfileDocumentCid(payload?.cid); }
  catch { throw new ProfileDocumentUploadError('The upload service returned an invalid IPFS CID', 'INVALID_UPLOAD_RESPONSE'); }
  return { artifact, cid: ipfsUri.slice('ipfs://'.length), ipfsUri };
}

