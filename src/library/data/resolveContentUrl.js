import { IPFS_GATEWAY_FALLBACK_URLS, IPFS_GATEWAY_URL, normalizePublicHttpsEndpointList } from '../config.js';
import { resolveVerifiedOnchainSvgDataUri } from './onchainDataUri.js';

function gatewayBase(gateway) {
  return `${String(gateway || IPFS_GATEWAY_URL).replace(/\/+$/, '')}/`;
}

export function resolveContentUrl(value, {
  ipfsGateway = IPFS_GATEWAY_URL, allowRelative = false, verification = null,
} = {}) {
  if (typeof value !== 'string') return null;
  const source = value.trim();
  if (!source) return null;
  if (allowRelative && /^\/(?!\/)/u.test(source) && !/[\s<>"']/u.test(source)) return source;
  if (/^ipfs:\/\//i.test(source)) {
    const path = source.replace(/^ipfs:\/\/(ipfs\/)?/i, '').replace(/^\/+/, '');
    if (!path || /[\s<>"']/u.test(path)) return null;
    return `${gatewayBase(ipfsGateway)}${path}`;
  }
  if (/^data:/iu.test(source)) return resolveVerifiedOnchainSvgDataUri(source, verification);
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.href;
  } catch {
    return null;
  }
}

export function resolveContentUrls(value, {
  ipfsGateway = IPFS_GATEWAY_URL,
  ipfsGatewayFallbackUrls = IPFS_GATEWAY_FALLBACK_URLS,
  ...options
} = {}) {
  if (typeof value !== 'string' || !/^ipfs:\/\//iu.test(value.trim())) {
    const resolved = resolveContentUrl(value, { ...options, ipfsGateway });
    return resolved ? [resolved] : [];
  }
  const gateways = [ipfsGateway, ...normalizePublicHttpsEndpointList(ipfsGatewayFallbackUrls).split(',')]
    .filter(Boolean);
  return [...new Set(gateways.map((gateway) => resolveContentUrl(value, { ...options, ipfsGateway: gateway }))
    .filter(Boolean))];
}

export function selectImageUrls(images, options) {
  const primary = selectImageGroups(images, options)[0];
  if (!primary) return { imageUrl: null, thumbnailUrl: null, originalImageUrl: null };
  return {
    thumbnailUrl: primary.thumbnailUrl,
    imageUrl: primary.imageUrl,
    originalImageUrl: primary.originalImageUrl,
    width: primary.width,
    height: primary.height,
    fileType: primary.fileType,
  };
}

export function selectImageGroups(images, options) {
  const groups = new Map();
  for (const image of Array.isArray(images) ? images : []) {
    const index = Number.isInteger(image?.index) && image.index >= 0 ? image.index : 0;
    const resolvedCandidates = [...new Set([image?.src, image?.url]
      .flatMap((source) => resolveContentUrls(source, { ...options, verification: image?.verification }))
      .filter(Boolean))];
    if (!resolvedCandidates.length) continue;
    if (!groups.has(index)) groups.set(index, []);
    groups.get(index).push(...resolvedCandidates.map((resolved, candidateIndex) => ({
      ...image, resolved, preferred: candidateIndex === 0,
    })));
  }

  return [...groups.entries()].sort(([first], [second]) => first - second).map(([index, variants]) => {
    const byWidth = [...variants].sort((first, second) => (Number(first.width) || Infinity) - (Number(second.width) || Infinity));
    const preferred = byWidth.filter((variant) => variant.preferred);
    const canonical = preferred.length ? preferred : byWidth;
    const thumbnail = canonical.find((variant) => (Number(variant.width) || 0) >= 320) || canonical[0];
    const largest = canonical.at(-1);
    return {
      index,
      thumbnailUrl: thumbnail.resolved,
      imageUrl: largest.resolved,
      originalImageUrl: largest.resolved,
      width: Number(largest.width) || null,
      height: Number(largest.height) || null,
      fileType: largest.fileType || null,
      variants: byWidth.map((variant) => ({
        url: variant.resolved,
        width: Number(variant.width) || null,
        height: Number(variant.height) || null,
        fileType: variant.fileType || null
      }))
    };
  });
}
