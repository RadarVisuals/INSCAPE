import { createCanonicalPublication, normalizeProfileDocumentCid } from '../domain/profileDocumentPublication.js';
import { assertProfileDocumentPublicationVersion } from '../domain/constants.js';

const DEFAULT_UPLOAD_ENDPOINT = '/api/profile-publications';
const DEFAULT_UPLOAD_TIMEOUT_MS = 50_000;

export class ProfileDocumentUploadError extends Error {
  constructor(message, code = 'UPLOAD_FAILED') {
    super(message);
    this.name = 'ProfileDocumentUploadError';
    this.code = code;
  }
}

export async function uploadProfileDocument(snapshot, {
  endpoint = DEFAULT_UPLOAD_ENDPOINT,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_UPLOAD_TIMEOUT_MS
} = {}) {
  assertProfileDocumentPublicationVersion(snapshot);
  const artifact = createCanonicalPublication(snapshot);
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: artifact.text,
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new ProfileDocumentUploadError('The IPFS upload timed out; retry shortly', 'UPLOAD_TIMEOUT');
    }
    throw new ProfileDocumentUploadError('The IPFS upload service could not be reached', 'UPLOAD_UNAVAILABLE');
  }

  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    throw new ProfileDocumentUploadError(payload?.error?.message || 'The IPFS upload failed', payload?.error?.code);
  }

  let ipfsUri;
  try { ipfsUri = normalizeProfileDocumentCid(payload?.cid); }
  catch { throw new ProfileDocumentUploadError('The upload service returned an invalid IPFS CID', 'INVALID_UPLOAD_RESPONSE'); }
  return { artifact, cid: ipfsUri.slice('ipfs://'.length), ipfsUri };
}

