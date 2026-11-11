import { MIN_RECEPTION_CELL_SIZE } from '../reception/editorCellGeometry.js';
import { validateProfileDocumentV9Asset } from '../profileDocument/domain/profileDocumentV9Asset.js';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';

export const MAX_IMAGE_MODULES = 16;
export const IMAGE_FILL_CROP = Object.freeze({ x: .5, y: .5, zoom: 1 });
export const IMAGE_MODULE_ID = /^image:[A-Za-z0-9_-]{1,80}$/u;
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const number = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
const validCrop = (crop, minimumZoom) => crop === null || exact(crop, ['x', 'y', 'zoom']) && number(crop.x, 0, 1) && number(crop.y, 0, 1) && number(crop.zoom, minimumZoom, 4);
export const IMAGE_SIZE_LIMITS = Object.freeze({ minimumWidth: 32, minimumHeight: 32, maximumWidth: 4096, maximumHeight: 4096 });
const CELL_IMAGE_LIMITS = Object.freeze({ ...IMAGE_SIZE_LIMITS, minimumHeight: MIN_RECEPTION_CELL_SIZE.height });
export const imageSizeLimits = inCell => inCell ? CELL_IMAGE_LIMITS : IMAGE_SIZE_LIMITS;
export const imageSize = (v, min = IMAGE_SIZE_LIMITS.minimumWidth, max = IMAGE_SIZE_LIMITS.maximumWidth) => Number.isInteger(v) && number(v, min, max);
export function validImageModules(items, published = false, { minimumCropZoom = 1, isCellMember } = {}) {
  if (!Array.isArray(items) || items.length > MAX_IMAGE_MODULES) return false;
  const ids = new Set();
  return items.every(item => {
    const limits = imageSizeLimits(isCellMember?.(item?.id));
    if (!exact(item, ['id', 'name', 'width', 'height', 'artwork', ...(!published ? ['visibility'] : [])])
      || !IMAGE_MODULE_ID.test(item.id) || ids.has(item.id)
      || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 48 || /[\u0000-\u001f\u007f]/u.test(item.name)
      || !imageSize(item.width, limits.minimumWidth, limits.maximumWidth) || !imageSize(item.height, limits.minimumHeight, limits.maximumHeight)
      || !published && !['PRIVATE', 'PUBLIC'].includes(item.visibility)) return false;
    ids.add(item.id);
    const artwork = item.artwork;
    if (artwork === null) return true;
    if (!exact(artwork, ['id', 'asset', 'crop', 'transform']) || !/^artwork:[A-Za-z0-9_-]{1,80}$/u.test(artwork.id)
      || !validateProfileDocumentV9Asset(artwork.asset) || artwork.asset.media.type !== 'image' || !artwork.asset.media.url
      || !Number.isSafeInteger(artwork.asset.media.width) || artwork.asset.media.width <= 0
      || !Number.isSafeInteger(artwork.asset.media.height) || artwork.asset.media.height <= 0
      || !validCrop(artwork.crop, minimumCropZoom)
      || !exact(artwork.transform, ['quarterTurns', 'mirrorX', 'mirrorY'])
      || !Number.isInteger(artwork.transform.quarterTurns) || !number(artwork.transform.quarterTurns, 0, 3)
      || typeof artwork.transform.mirrorX !== 'boolean' || typeof artwork.transform.mirrorY !== 'boolean') return false;
    return true;
  });
}
export const imageReferenceCount = items => Array.isArray(items) ? items.filter(item => item?.artwork).length : 0;
export const projectImageModules = items => structuredClone(items.filter(item => item.visibility === 'PUBLIC').map(({ visibility, ...item }) => item));
export const restoreImageModules = (published = [], local = []) => structuredClone([
  ...published.map(item => ({ ...item, visibility: 'PUBLIC' })),
  ...local.filter(item => !published.some(other => other.id === item.id)).map(item => ({ ...item, visibility: 'PRIVATE' })),
]);
export const createImagePresentation = (id, index = 0) => ({ id, open: true, position: { left: 140 + index * 24, top: 100 + index * 24 } });
export function imageFocusEntry(artwork) {
  return { placement: { id: artwork.id, crop: artwork.crop, transform: artwork.transform,
    inspectionMode: 'LIFT' },
  media: { src: resolvePublishedAssetUrl(artwork.asset.media.url) }, focusDimensions: { width: artwork.asset.media.width, height: artwork.asset.media.height },
  accessibleLabel: artwork.asset.name || 'Artwork' };
}
