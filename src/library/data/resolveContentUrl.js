import { IPFS_GATEWAY_URL } from '../config.js';

function gatewayBase(gateway) {
  return `${String(gateway || IPFS_GATEWAY_URL).replace(/\/+$/, '')}/`;
}

export function resolveContentUrl(value, { ipfsGateway = IPFS_GATEWAY_URL, allowRelative = false } = {}) {
  if (typeof value !== 'string') return null;
  const source = value.trim();
  if (!source) return null;
  if (allowRelative && /^\/(?!\/)/u.test(source) && !/[\s<>"']/u.test(source)) return source;
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
  return {
    thumbnailUrl: thumbnail.resolved,
    imageUrl: largest.resolved,
    originalImageUrl: largest.url || largest.src || null,
    width: Number(largest.width) || null,
    height: Number(largest.height) || null
  };
}

export function selectImageGroups(images, options) {
  const groups = new Map();
  for (const image of Array.isArray(images) ? images : []) {
    const resolved = resolveContentUrl(image?.src || image?.url, options);
    if (!resolved) continue;
    const index = Number.isInteger(image?.index) && image.index >= 0 ? image.index : 0;
    if (!groups.has(index)) groups.set(index, []);
    groups.get(index).push({ ...image, resolved });
  }

  return [...groups.entries()].sort(([first], [second]) => first - second).map(([index, variants]) => {
    const byWidth = [...variants].sort((first, second) => (Number(first.width) || Infinity) - (Number(second.width) || Infinity));
    const thumbnail = byWidth.find((variant) => (Number(variant.width) || 0) >= 320) || byWidth[0];
    const largest = byWidth.at(-1);
    return {
      index,
      thumbnailUrl: thumbnail.resolved,
      imageUrl: largest.resolved,
      originalImageUrl: largest.resolved,
      width: Number(largest.width) || null,
      height: Number(largest.height) || null,
      variants: byWidth.map((variant) => ({
        url: variant.resolved,
        width: Number(variant.width) || null,
        height: Number(variant.height) || null,
        fileType: variant.fileType || null
      }))
    };
  });
}
