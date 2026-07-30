import { normalizeProfileAddress } from '../../library/config.js';
import { resolveContentUrl } from '../../library/data/resolveContentUrl.js';

export const PROFILE_IDENTITY_STATUS = Object.freeze({
  IDLE: 'IDLE', LOADING: 'LOADING', RESOLVED: 'RESOLVED', UNAVAILABLE: 'UNAVAILABLE', ERROR: 'ERROR'
});
export const LSP3_METADATA_LIMITS = Object.freeze({
  name: 80, description: 20_000, tags: 12, tag: 48, links: 8, linkLabel: 64, linkUrl: 2048,
  verificationValue: 512, tokenId: 128
});

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const cleanText = (value, maxLength) => {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ').replace(/\s+/gu, ' ').trim();
  return clean ? clean.slice(0, maxLength) : null;
};

const cleanLongText = (value, maxLength) => {
  if (typeof value !== 'string') return null;
  const clean = value
    .replace(/\r\n?/gu, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu, ' ')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n[ \t]+/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
  return clean ? clean.slice(0, maxLength) : null;
};

function normalizeVerification(verification) {
  if (!verification || typeof verification !== 'object') return null;
  const method = cleanText(verification.method, 80);
  const data = cleanText(verification.data, LSP3_METADATA_LIMITS.verificationValue);
  return method && data ? { method, data, status: 'DECLARED' } : null;
}

export function normalizeLsp3ImageCandidates(images, options = {}) {
  const source = options.source || 'LSP3';
  return (Array.isArray(images) ? images.flat(1) : []).flatMap((image, index) => {
    if (!image || typeof image !== 'object') return [];
    const width = Math.max(0, Number(image.width) || 0);
    const height = Math.max(0, Number(image.height) || 0);
    const verification = normalizeVerification(image.verification);
    const rawUrl = typeof (image.url ?? image.src) === 'string' ? (image.url ?? image.src).trim() : '';
    const url = rawUrl ? resolveContentUrl(rawUrl, options) : null;
    if (url) return [{ id: `${source.toLowerCase()}-url-${index + 1}`, kind: 'URL', url, rawUrl, width, height, verification, source }];
    const address = normalizeProfileAddress(image.address);
    const tokenId = cleanText(typeof image.tokenId === 'number' ? String(image.tokenId) : image.tokenId, LSP3_METADATA_LIMITS.tokenId);
    if (address && tokenId) return [{ id: `${source.toLowerCase()}-token-${index + 1}`, kind: 'TOKEN_REFERENCE', address, tokenId, width, height, verification, source }];
    return [];
  });
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const normalized = [];
  for (const tag of tags) {
    const clean = cleanText(tag, LSP3_METADATA_LIMITS.tag);
    if (!clean) continue;
    normalized.push(clean);
    if (normalized.length === LSP3_METADATA_LIMITS.tags) break;
  }
  return normalized;
}

function normalizeLinks(links, options) {
  if (!Array.isArray(links)) return [];
  const normalized = [];
  for (const link of links) {
    if (!link || typeof link !== 'object') continue;
    const label = cleanText(link.title ?? link.label, LSP3_METADATA_LIMITS.linkLabel);
    const rawUrl = typeof link.url === 'string' ? link.url.trim() : '';
    if (!label || !rawUrl || rawUrl.length > LSP3_METADATA_LIMITS.linkUrl || CONTROL_CHARACTERS.test(rawUrl)) continue;
    const url = resolveContentUrl(rawUrl, options);
    if (!url) continue;
    normalized.push({ id: `lsp3-link-${normalized.length + 1}`, label, url });
    if (normalized.length === LSP3_METADATA_LIMITS.links) break;
  }
  return normalized;
}

export function createProfileIdentity(address, overrides = {}) {
  const normalizedAddress = normalizeProfileAddress(address);
  if (!normalizedAddress) throw new TypeError('A valid address is required');
  return {
    address: normalizedAddress, normalizedAddress, name: null, avatarUrl: null, description: null,
    profileImageCandidates: [], backgroundImageCandidates: [], tags: [], links: [],
    isUniversalProfile: false, metadataIntegrity: 'UNRESOLVED', status: PROFILE_IDENTITY_STATUS.IDLE,
    source: overrides.source || 'LIVE', errorCode: null, ...overrides,
    address: normalizedAddress, normalizedAddress
  };
}

export function selectProfileAvatar(images, options = {}) {
  const candidates = normalizeLsp3ImageCandidates(images, options)
    .filter((image) => image.kind === 'URL')
    .sort((a, b) => a.width - b.width);
  return candidates.length ? (candidates.find((image) => image.width >= 64) || candidates.at(-1)).url : null;
}

export function normalizeLsp3Identity(address, profile, options = {}) {
  const normalizedAddress = normalizeProfileAddress(address);
  if (!normalizedAddress || !profile || typeof profile !== 'object' || Array.isArray(profile)) return null;
  const profileImageCandidates = normalizeLsp3ImageCandidates(profile.profileImage, { ...options, source: 'LSP3_PROFILE_IMAGE' });
  const backgroundImageCandidates = normalizeLsp3ImageCandidates(profile.backgroundImage, { ...options, source: 'LSP3_BACKGROUND_IMAGE' });
  const avatarCandidates = profileImageCandidates.filter((image) => image.kind === 'URL').sort((a, b) => a.width - b.width);
  const avatarUrl = (avatarCandidates.find((image) => image.width >= 64) || avatarCandidates.at(-1))?.url || null;
  return createProfileIdentity(normalizedAddress, {
    name: cleanText(profile.name, LSP3_METADATA_LIMITS.name),
    description: cleanLongText(profile.description, LSP3_METADATA_LIMITS.description), avatarUrl,
    profileImageCandidates, backgroundImageCandidates,
    tags: normalizeTags(profile.tags), links: normalizeLinks(profile.links, options),
    isUniversalProfile: true,
    metadataIntegrity: options.metadataIntegrity || (options.source === 'LIVE' ? 'VERIFIED' : 'UNVERIFIED'),
    status: PROFILE_IDENTITY_STATUS.RESOLVED, source: options.source || 'LIVE'
  });
}

export function createUnavailableIdentity(address, { source = 'LIVE', errorCode = 'METADATA_UNAVAILABLE', isUniversalProfile = false } = {}) {
  return createProfileIdentity(address, { status: PROFILE_IDENTITY_STATUS.UNAVAILABLE, source, errorCode, isUniversalProfile });
}
export function createErrorIdentity(address, { source = 'LIVE', errorCode = 'NETWORK_ERROR' } = {}) {
  return createProfileIdentity(address, { status: PROFILE_IDENTITY_STATUS.ERROR, source, errorCode });
}
export function getOfficialProfileUrl(address) {
  const normalized = normalizeProfileAddress(address);
  return normalized ? `https://universaleverything.io/${normalized}` : null;
}
