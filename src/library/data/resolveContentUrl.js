import { IPFS_GATEWAY_URL } from '../config.js';

function gatewayBase(gateway) {
  return `${String(gateway || IPFS_GATEWAY_URL).replace(/\/+$/, '')}/`;
}

export function resolveContentUrl(value, { ipfsGateway = IPFS_GATEWAY_URL } = {}) {
  if (typeof value !== 'string') return null;
  const source = value.trim();
  if (!source) return null;
  if (/^ipfs:\/\//i.test(source)) {
    const path = source.replace(/^ipfs:\/\/(ipfs\/)?/i, '').replace(/^\/+/, '');
    if (!path || /[\s<>"']/u.test(path)) return null;
    return `${gatewayBase(ipfsGateway)}${path}`;
  }
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.href;
  } catch {
    return null;
  }
}

export function selectImageUrls(images, options) {
  const valid = (Array.isArray(images) ? images : [])
    .map((image) => ({ ...image, resolved: resolveContentUrl(image?.src || image?.url, options) }))
    .filter((image) => image.resolved);
  if (!valid.length) return { imageUrl: null, thumbnailUrl: null, originalImageUrl: null };
  const byWidth = [...valid].sort((a, b) => (Number(a.width) || Infinity) - (Number(b.width) || Infinity));
  const thumbnail = byWidth.find((image) => (Number(image.width) || 0) >= 320) || byWidth[0];
  const largest = byWidth.at(-1);
  return { thumbnailUrl: thumbnail.resolved, imageUrl: largest.resolved, originalImageUrl: largest.url || largest.src || null };
}
