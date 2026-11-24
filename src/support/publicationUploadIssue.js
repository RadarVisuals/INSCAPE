// Remote status codes are untrusted. Only these known causes and local phase
// labels can reach the UI or the copyable support report.
const messages = {
  DOCUMENT_TOO_LARGE: 'The publication is larger than the upload service accepts.',
  INVALID_PROFILE_DOCUMENT: 'The upload service rejected this prepared document before a transaction could be requested. Check that the app and upload service use the same document format, then reopen Publish.',
  INVALID_UPLOAD_CHALLENGE: 'The service could not validate the upload authorization request.',
  INVALID_UPLOAD_RESPONSE: 'The service returned an invalid IPFS content identifier.',
  IPFS_UPLOAD_REJECTED: 'The IPFS service rejected the upload. Check the service configuration.',
  METHOD_NOT_ALLOWED: 'The publication endpoint does not accept upload requests.',
  NON_CANONICAL_DOCUMENT: 'The uploaded document does not match its prepared publication.',
  NOT_FOUND: 'The publication endpoint was not found.',
  ORIGIN_NOT_ALLOWED: 'The publication service does not accept this site’s origin.',
  PREFLIGHT_NOT_ALLOWED: 'The publication endpoint does not allow this upload request.',
  PUBLICATION_FUNCTION_UNAVAILABLE: 'The publication endpoint did not return a service response.',
  PUBLICATION_SERVICE_UPDATE_REQUIRED: 'The publication service must be updated for this document format. No wallet signature was requested.',
  UNSUPPORTED_MEDIA_TYPE: 'The service could not read the publication format.',
  UPLOAD_AUTH_INVALID: 'Upload authorization is invalid or expired. Authorize the upload again.',
  UPLOAD_AUTH_NOT_COMPLETED: 'Upload authorization was not completed in the wallet.',
  UPLOAD_AUTH_REQUIRED: 'The service requires a new upload authorization.',
  UPLOAD_AUTH_UNAVAILABLE: 'The service could not verify the upload authorization.',
  UPLOAD_AUTH_USED: 'This upload authorization has already been used.',
  UPLOAD_CANCELLED: 'The upload request was cancelled.',
  UPLOAD_CHALLENGE_INVALID: 'The service returned an invalid upload challenge.',
  UPLOAD_CONTEXT_CHANGED: 'The profile, wallet or presentation changed. Prepare the publication again.',
  UPLOAD_NOT_CONFIGURED: 'Public IPFS upload is not configured for this deployment.',
  UPLOAD_ORIGIN_INVALID: 'The publication endpoint is not permitted for this site.',
  UPLOAD_OUTCOME_UNKNOWN: 'The upload outcome is unknown. Check the previous result before retrying.',
  UPLOAD_PROFILE_INVALID: 'The service could not verify the Universal Profile on LUKSO mainnet.',
  UPLOAD_PROFILE_QUOTA: 'Your profile has reached its hourly upload limit.',
  UPLOAD_QUOTA_UNAVAILABLE: 'The service could not verify the upload allowance.',
  UPLOAD_RATE_LIMITED: 'The upload request limit was reached. Try again later.',
  UPLOAD_SERVICE_QUOTA: 'The publication service has reached its upload limit.',
  UPLOAD_SIGNATURE_INVALID: 'Upload authorization has an invalid signature.',
  UPLOAD_SIGNATURE_UNAVAILABLE: 'This wallet does not support upload authorization signatures.',
  UPLOAD_TIMEOUT: 'The publication service timed out.',
  UPLOAD_UNAVAILABLE: 'The publication service is unavailable.',
  UPLOAD_CHALLENGE_FAILED: 'The publication service could not provide an upload challenge.',
  UPLOAD_AUTHORIZATION_FAILED: 'The wallet could not authorize the upload.',
  IPFS_UPLOAD_FAILED: 'The presentation could not be uploaded to IPFS.',
};

export const isPublicationUploadCode = code => typeof code === 'string' && Object.hasOwn(messages, code);

export function publicationUploadIssue(error, stage) {
  const authorizing = stage === 'AUTHORIZING', uploading = stage === 'UPLOADING';
  const code = isPublicationUploadCode(error?.code) ? error.code
    : authorizing ? 'UPLOAD_AUTHORIZATION_FAILED' : uploading ? 'IPFS_UPLOAD_FAILED' : 'UPLOAD_CHALLENGE_FAILED';
  const phase = code === 'UPLOAD_ORIGIN_INVALID' ? 'UPLOAD_ENDPOINT'
    : authorizing ? 'UPLOAD_AUTHORIZATION' : uploading ? 'IPFS_UPLOAD' : 'UPLOAD_CHALLENGE';
  let message = messages[code];
  if (code === 'UPLOAD_TIMEOUT' && uploading) message += ' Check the previous result before authorizing another upload.';
  const step = { UPLOAD_ENDPOINT: 'Checking the endpoint', UPLOAD_CHALLENGE: 'Requesting upload access',
    UPLOAD_AUTHORIZATION: 'Authorizing in the wallet', IPFS_UPLOAD: 'Uploading the presentation' }[phase];
  const providerCategory = phase === 'UPLOAD_ENDPOINT' || code === 'UPLOAD_CONTEXT_CHANGED' ? 'LOCAL_VALIDATION'
    : authorizing ? 'WALLET' : 'PUBLICATION_SERVICE';
  return { code, phase, providerCategory, message: step + '. ' + message };
}
