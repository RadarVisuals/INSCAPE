import { normalizeProfileAddress } from '../../library/config.js';
import { PROFILE_DOCUMENT_LIMITS as L } from './constants.js';
import { identityRackModuleIsVisible } from './profileDocumentRacks.js';
import { isValidPublishedAssetUrl, parsePublishedAssetUrl } from './publishedAssetUrl.js';

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const WHITESPACE = /\s/u;
const IDENTITY_KEYS = Object.freeze(['address', 'name', 'avatarUrl', 'description', 'tags', 'links']);
const LINK_KEYS = Object.freeze(['label', 'url']);

const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).every((key) => keys.includes(key));
const validText = (value, maximum) => typeof value === 'string' && value.trim().length > 0
  && value.length <= maximum && !CONTROL_CHARACTERS.test(value);

function cleanText(value, maximum) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, maximum);
}

export function normalizePublishedIdentityLinkUrl(value) {
  if (typeof value !== 'string' || value.length > L.maxUrlLength || value !== value.trim()
    || CONTROL_CHARACTERS.test(value) || WHITESPACE.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function cleanProfileDocumentIdentity(identity, address, racks) {
  const value = { address };
  if (identityRackModuleIsVisible(racks, 'profile')) {
    const name = cleanText(identity?.name, L.maxNameLength);
    const avatarCandidate = typeof identity?.avatarUrl === 'string' ? identity.avatarUrl.trim().slice(0, L.maxUrlLength) : '';
    const avatarUrl = parsePublishedAssetUrl(avatarCandidate)?.value || '';
    if (name) value.name = name;
    if (avatarUrl) value.avatarUrl = avatarUrl;
  }
  if (identityRackModuleIsVisible(racks, 'bio')) {
    const description = cleanText(identity?.description, L.maxIdentityDescriptionLength);
    if (description) value.description = description;
  }
  if (identityRackModuleIsVisible(racks, 'links-tags')) {
    const tags = [];
    for (const candidate of Array.isArray(identity?.tags) ? identity.tags : []) {
      const tag = cleanText(candidate, L.maxIdentityTagLength);
      if (!tag || tags.includes(tag)) continue;
      tags.push(tag);
      if (tags.length === L.maxIdentityTags) break;
    }
    const links = [];
    for (const candidate of Array.isArray(identity?.links) ? identity.links : []) {
      const label = cleanText(candidate?.label ?? candidate?.title, L.maxIdentityLinkLabelLength);
      const url = normalizePublishedIdentityLinkUrl(candidate?.url);
      if (!label || !url || links.some((link) => link.url === url)) continue;
      links.push({ label, url });
      if (links.length === L.maxIdentityLinks) break;
    }
    if (tags.length) value.tags = tags;
    if (links.length) value.links = links;
  }
  return value;
}

export function isValidProfileDocumentIdentity(identity, address, racks) {
  if (!exactKeys(identity, IDENTITY_KEYS) || normalizeProfileAddress(identity?.address) !== address) return false;
  if (identity.name !== undefined && !validText(identity.name, L.maxNameLength)) return false;
  if (identity.avatarUrl !== undefined && (typeof identity.avatarUrl !== 'string' || identity.avatarUrl.length > L.maxUrlLength || !isValidPublishedAssetUrl(identity.avatarUrl))) return false;
  if (identity.description !== undefined && !validText(identity.description, L.maxIdentityDescriptionLength)) return false;
  if (identity.tags !== undefined && (!Array.isArray(identity.tags) || identity.tags.length > L.maxIdentityTags
    || new Set(identity.tags).size !== identity.tags.length || identity.tags.some((tag) => !validText(tag, L.maxIdentityTagLength)))) return false;
  if (identity.links !== undefined && (!Array.isArray(identity.links) || identity.links.length > L.maxIdentityLinks
    || new Set(identity.links.map((link) => link?.url)).size !== identity.links.length
    || identity.links.some((link) => !exactKeys(link, LINK_KEYS) || !validText(link.label, L.maxIdentityLinkLabelLength)
      || normalizePublishedIdentityLinkUrl(link.url) !== link.url))) return false;
  if (!identityRackModuleIsVisible(racks, 'profile') && (identity.name !== undefined || identity.avatarUrl !== undefined)) return false;
  if (!identityRackModuleIsVisible(racks, 'bio') && identity.description !== undefined) return false;
  if (!identityRackModuleIsVisible(racks, 'links-tags') && (identity.tags !== undefined || identity.links !== undefined)) return false;
  return true;
}
