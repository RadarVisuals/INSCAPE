import { PROFILE_DOCUMENT_IPFS_GATEWAY_URL } from '../../library/config.js';
import { isValidCid } from './cidValidation.js';

const FORBIDDEN = /[\s\u0000-\u001f\u007f\\<>"']/u;
const ENCODED_CONTROL = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/iu;

function parseHttps(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
  return url.href;
}

export function parsePublishedAssetUrl(value) {
  if (typeof value !== 'string' || !value || value.length > 2048 || value !== value.trim()
    || FORBIDDEN.test(value) || ENCODED_CONTROL.test(value) || value.startsWith('//')) return null;
  if (/^ipfs:\/\//iu.test(value)) {
    const reference = value.slice(7);
    const [cid, ...parts] = reference.split('/');
    if (!isValidCid(cid) || reference.includes('?') || reference.includes('#')
      || parts.some((part) => !part || part === '.' || part === '..')) return null;
    return { scheme: 'ipfs', value: `ipfs://${cid.startsWith('B') ? `b${cid.slice(1).toLowerCase()}` : cid}${parts.length ? `/${parts.join('/')}` : ''}` };
  }
  const https = parseHttps(value);
  return https ? { scheme: 'https', value: https } : null;
}

export function isValidPublishedAssetUrl(value) { return Boolean(parsePublishedAssetUrl(value)); }

export function resolvePublishedAssetUrl(value, { ipfsGateway = PROFILE_DOCUMENT_IPFS_GATEWAY_URL } = {}) {
  const parsed = parsePublishedAssetUrl(value);
  if (!parsed) return null;
  if (parsed.scheme === 'https') return parsed.value;
  const gateway = parseHttps(String(ipfsGateway || ''));
  if (!gateway) return null;
  const target = new URL(gateway);
  target.pathname = `${target.pathname.replace(/\/+$/u, '')}/${parsed.value.slice(7)}`;
  return target.href;
}
