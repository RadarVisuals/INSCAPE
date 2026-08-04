const RELEASE_COMMIT = typeof __INSCAPE_RELEASE_COMMIT__ !== 'undefined'
  ? String(__INSCAPE_RELEASE_COMMIT__)
  : 'development';

export const ALPHA_SUPPORT_CODES = Object.freeze({
  AUTHORITY_INITIALIZATION_FAILED: 'AUTHORITY_INITIALIZATION_FAILED',
  ASSET_DISCOVERY_FAILED: 'ASSET_DISCOVERY_FAILED',
  PREVIEW_VALIDATION_FAILED: 'PREVIEW_VALIDATION_FAILED',
  IPFS_UPLOAD_FAILED: 'IPFS_UPLOAD_FAILED',
  CID_VERIFICATION_FAILED: 'CID_VERIFICATION_FAILED',
  WALLET_REJECTED: 'WALLET_REJECTED',
  WALLET_PROVIDER_FAILED: 'WALLET_PROVIDER_FAILED',
  TRANSACTION_TIMEOUT: 'TRANSACTION_TIMEOUT',
  TRANSACTION_REVERTED: 'TRANSACTION_REVERTED',
  TRANSACTION_REPLACED: 'TRANSACTION_REPLACED',
  PUBLICATION_RESOLUTION_FAILED: 'PUBLICATION_RESOLUTION_FAILED',
  PUBLISHED_DOCUMENT_FAILED: 'PUBLISHED_DOCUMENT_FAILED',
  PUBLISHED_MEDIA_FAILED: 'PUBLISHED_MEDIA_FAILED',
  UNEXPECTED_APPLICATION_ERROR: 'UNEXPECTED_APPLICATION_ERROR',
  ALPHA_SUPPORT_REQUEST: 'ALPHA_SUPPORT_REQUEST',
});

const CODES = new Set(Object.values(ALPHA_SUPPORT_CODES));
const PUBLIC_ADDRESS = /^0x[0-9a-f]{40}$/iu;
const TRANSACTION_HASH = /^0x[0-9a-f]{64}$/iu;

function boundedText(value, maximum = 180) {
  if (typeof value !== 'string') return null;
  const text = value
    .replace(/https?:\/\/\S+/giu, '[url omitted]')
    .replace(/0x[0-9a-f]{65,}/giu, '[hex omitted]')
    .replace(/\b(?:authorization|token|secret|jwt|signature|calldata)\s*[:=]\s*\S+/giu, '[private value omitted]')
    .replace(/\s+/gu, ' ')
    .trim();
  return text ? text.slice(0, maximum) : null;
}

export function resolveAlphaRouteClass(locationLike = {}) {
  const search = new URLSearchParams(locationLike.search || '');
  if (search.get('mode') === 'atelier') return 'ATELIER';
  if (search.has('view')) return 'DIRECT_PROFILE';
  if (search.has('profile')) return 'OWNER_OR_PROFILE';
  return 'PUBLIC_ENTRY';
}

export function resolveAlphaViewportClass(width = globalThis.innerWidth) {
  if (!Number.isFinite(width)) return 'UNKNOWN';
  if (width < 720) return 'NARROW';
  if (width < 1200) return 'MEDIUM';
  return 'WIDE';
}

export function resolveAlphaBrowserClass(userAgent = globalThis.navigator?.userAgent) {
  const value = typeof userAgent === 'string' ? userAgent : '';
  const edge = value.match(/\bEdg\/([0-9]+(?:\.[0-9]+)?)/u);
  if (edge) return `EDGE/${edge[1]}`;
  const chrome = value.match(/\bChrome\/([0-9]+(?:\.[0-9]+)?)/u);
  if (chrome) return `CHROME/${chrome[1]}`;
  const firefox = value.match(/\bFirefox\/([0-9]+(?:\.[0-9]+)?)/u);
  if (firefox) return `FIREFOX/${firefox[1]}`;
  const safari = value.match(/\bVersion\/([0-9]+(?:\.[0-9]+)?).*\bSafari\//u);
  return safari ? `SAFARI/${safari[1]}` : 'UNKNOWN';
}

export function createAlphaSupportEvidence({
  code,
  phase,
  providerCategory,
  profileAddress,
  transactionHash,
  routeClass,
  releaseCommit = RELEASE_COMMIT,
  userAgent = globalThis.navigator?.userAgent,
  viewportWidth = globalThis.innerWidth,
} = {}) {
  const evidence = {
    product: 'INSCAPE ALPHA',
    release: /^[0-9a-f]{7,40}$/iu.test(releaseCommit) ? releaseCommit.toLowerCase() : boundedText(releaseCommit, 48) || 'unknown',
    route: boundedText(routeClass, 40) || resolveAlphaRouteClass(globalThis.location),
    viewport: resolveAlphaViewportClass(viewportWidth),
    browser: resolveAlphaBrowserClass(userAgent),
    code: CODES.has(code) ? code : ALPHA_SUPPORT_CODES.UNEXPECTED_APPLICATION_ERROR,
  };
  const safePhase = boundedText(phase, 48);
  const safeProvider = boundedText(providerCategory, 48);
  if (safePhase) evidence.phase = safePhase;
  if (safeProvider) evidence.provider = safeProvider;
  if (PUBLIC_ADDRESS.test(profileAddress || '')) evidence.publicProfile = profileAddress.toLowerCase();
  if (TRANSACTION_HASH.test(transactionHash || '')) evidence.transactionHash = transactionHash.toLowerCase();
  return Object.freeze(evidence);
}

export function formatAlphaSupportEvidence(evidence) {
  return Object.entries(evidence).map(([key, value]) => `${key}: ${value}`).join('\n');
}

export function classifyPublicationSupportCode(error, described = '') {
  const text = `${error?.name || ''} ${error?.code || ''} ${error?.message || ''} ${described}`;
  if (Number(error?.code) === 4001 || /rejected by the user|UserRejected/iu.test(text)) return ALPHA_SUPPORT_CODES.WALLET_REJECTED;
  if (/replaced|repriced|cancelled/iu.test(text)) return ALPHA_SUPPORT_CODES.TRANSACTION_REPLACED;
  if (/receipt.*tim(?:e|ed)\s*out|RECEIPT_TIMEOUT/iu.test(text)) return ALPHA_SUPPORT_CODES.TRANSACTION_TIMEOUT;
  if (/revert|RECEIPT_REVERTED/iu.test(text)) return ALPHA_SUPPORT_CODES.TRANSACTION_REVERTED;
  if (/published document|resolver|pointer|mismatch/iu.test(text)) return ALPHA_SUPPORT_CODES.PUBLICATION_RESOLUTION_FAILED;
  return ALPHA_SUPPORT_CODES.WALLET_PROVIDER_FAILED;
}

export function alphaRecoveryGuidance(code, transactionHash = null) {
  if (transactionHash && TRANSACTION_HASH.test(transactionHash)) {
    return 'A transaction hash exists. Do not submit another publication transaction. Copy these details and ask support to investigate the existing hash.';
  }
  if (code === ALPHA_SUPPORT_CODES.WALLET_REJECTED) return 'Nothing was submitted. Review the request before trying again.';
  if ([ALPHA_SUPPORT_CODES.TRANSACTION_TIMEOUT, ALPHA_SUPPORT_CODES.TRANSACTION_REVERTED,
    ALPHA_SUPPORT_CODES.TRANSACTION_REPLACED].includes(code)) {
    return 'Stop before retrying. If a wallet supplied a transaction hash, include it in the support report and do not submit a duplicate transaction.';
  }
  return 'No submitted transaction is known. Copy these details and ask for help before retrying an ambiguous wallet action.';
}
