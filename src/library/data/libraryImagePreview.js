import { UP_IMAGE_SERVICE_URL } from '../config.js';
import { resolvePublishedAssetUrl } from '../../profileDocument/domain/publishedAssetUrl.js';

export function libraryFileFormat(url, fileType) {
  const mime = String(fileType || '').split(';')[0].toLowerCase();
  const formats = { 'image/svg+xml': 'SVG', 'image/jpeg': 'JPG', 'text/plain': 'TXT', 'text/html': 'HTML' };
  const extension = String(url || '').split(/[?#]/)[0].match(/\.([a-z0-9]{2,5})$/i)?.[1];
  return (formats[mime] || extension || mime.split('/')[1] || 'FILE').toUpperCase();
}

// Only public IPFS resources use the UP image service. Original URLs remain
// untouched; SVG/GIF retain their animation instead of acquiring a raster proxy.
export function libraryPreviewUrl(source, width = 256, fileType) {
  const resolved = resolvePublishedAssetUrl(source);
  if (!resolved || ['SVG', 'GIF'].includes(libraryFileFormat(source, fileType))) return resolved;
  try {
    const url = new URL(resolved);
    if (!['api.universalprofile.cloud', 'ipfs.io', 'dweb.link'].includes(url.hostname)) return resolved;
    const path = url.pathname.match(/^\/(?:ipfs|image)\/(.+)$/)?.[1];
    if (!path) return resolved;
    const service = new URL(UP_IMAGE_SERVICE_URL);
    url.host = service.host; url.protocol = service.protocol; url.pathname = service.pathname + path;
    url.searchParams.delete('dpr'); url.searchParams.delete('height');
    url.searchParams.set('width', String(Math.min(1024, Math.max(64, Math.ceil(width)))));
    return url.href;
  } catch { return resolved; }
}

export function libraryPreviewCandidates(group, size = 150, dpr = 1) {
  const target = Math.min(1024, Math.ceil(size * Math.min(3, Math.max(1, dpr))));
  const width = [128, 180, 256, 320, 512, 640, 1024].find(value => value >= target) || 1024;
  const variants = (group?.variants || []).filter(v => v.url && v.width > 0).slice().sort((a, b) => a.width - b.width);
  const chosen = variants.find(v => v.width >= width) || variants.at(-1);
  const source = chosen?.url || group?.thumbnailUrl || group?.originalImageUrl || group?.imageUrl || group?.variants?.[0]?.url;
  return [...new Set([libraryPreviewUrl(source, width, chosen?.fileType || group?.fileType), source,
    group?.thumbnailUrl, group?.imageUrl, group?.originalImageUrl, ...(group?.variants || []).map(v => v.url)].map(resolvePublishedAssetUrl).filter(Boolean))];
}

// Disposable decoded previews bridge Library and canvas. They never enter a
// document. Bound by URL and count; a new successful preview replaces the old one.
const previews = new Map();
export function rememberArtworkPreview(original, preview, width, height) {
  if (!original || !preview || !(width > 0 && height > 0)) return;
  previews.delete(original); previews.set(original, { url: preview, width, height });
  if (previews.size > 128) previews.delete(previews.keys().next().value);
}
export const artworkPreview = original => previews.get(original) || null;

export function libraryFilename(source) {
  const name = String(source || '').split(/[?#]/)[0].split('/').at(-1);
  try { return decodeURIComponent(name); } catch { return name; }
}

export function isResizedLibraryPreview(source) {
  try { const url = new URL(source); return url.origin === new URL(UP_IMAGE_SERVICE_URL).origin && url.pathname.startsWith('/image/') && url.searchParams.has('width'); } catch { return false; }
}
