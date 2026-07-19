import { normalizeProfileAddress } from '../../library/config.js';
import { resolveContentUrl } from '../../library/data/resolveContentUrl.js';

export const PROFILE_IDENTITY_STATUS = Object.freeze({
  IDLE: 'IDLE', LOADING: 'LOADING', RESOLVED: 'RESOLVED', UNAVAILABLE: 'UNAVAILABLE', ERROR: 'ERROR'
});
export const LSP3_METADATA_LIMITS = Object.freeze({
  name: 80, description: 480, tags: 12, tag: 48, links: 8, linkLabel: 64, linkUrl: 2048
});

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const cleanText = (value, maxLength) => {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ').replace(/\s+/gu, ' ').trim();
  return clean ? clean.slice(0, maxLength) : null;
};

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
    tags: [], links: [], isUniversalProfile: false, status: PROFILE_IDENTITY_STATUS.IDLE,
    source: overrides.source || 'LIVE', errorCode: null, ...overrides,
    address: normalizedAddress, normalizedAddress
  };
}

export function selectProfileAvatar(images, options = {}) {
  const candidates = (Array.isArray(images) ? images : [])
    .map((image) => ({ url: resolveContentUrl(image?.url || image?.src, options), width: Number(image?.width) || 0 }))
    .filter((image) => image.url)
    .sort((a, b) => a.width - b.width);
  return candidates.length ? (candidates.find((image) => image.width >= 64) || candidates.at(-1)).url : null;
}

export function normalizeLsp3Identity(address, profile, options = {}) {
  const normalizedAddress = normalizeProfileAddress(address);
  if (!normalizedAddress || !profile || typeof profile !== 'object' || Array.isArray(profile)) return null;
  return createProfileIdentity(normalizedAddress, {
    name: cleanText(profile.name, LSP3_METADATA_LIMITS.name),
    description: cleanText(profile.description, LSP3_METADATA_LIMITS.description),
    avatarUrl: selectProfileAvatar(profile.profileImage, options),
    tags: normalizeTags(profile.tags), links: normalizeLinks(profile.links, options),
    isUniversalProfile: true, status: PROFILE_IDENTITY_STATUS.RESOLVED, source: options.source || 'LIVE'
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
