import { validateProfileDocumentV9Asset } from '../profileDocument/domain/profileDocumentV9Asset.js';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';

export const MAX_IMAGE_MODULES = 16;
export const MAX_IMAGE_SIDES = 32;
export const IMAGE_MODULE_ID = /^image:[A-Za-z0-9_-]{1,80}$/u;
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const number = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
export const imageSize = v => Number.isInteger(v) && number(v, 32, 4096);
export function validImageModules(items, published = false) {
  if (!Array.isArray(items) || items.length > MAX_IMAGE_MODULES) return false;
  const ids = new Set();
  return items.every(item => {
    if (!exact(item, ['id', 'name', 'width', 'height', 'sides', ...(!published ? ['visibility'] : [])])
      || !IMAGE_MODULE_ID.test(item.id) || ids.has(item.id)
      || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 48 || /[\u0000-\u001f\u007f]/u.test(item.name)
      || !imageSize(item.width) || !imageSize(item.height)
      || !published && !['PRIVATE', 'PUBLIC'].includes(item.visibility)
      || !Array.isArray(item.sides) || item.sides.length > MAX_IMAGE_SIDES) return false;
    ids.add(item.id);
    const sides = new Set();
    return item.sides.every(side => {
      if (!exact(side, ['id', 'asset', 'crop', 'transform']) || !/^side:[A-Za-z0-9_-]{1,80}$/u.test(side.id) || sides.has(side.id)
        || !validateProfileDocumentV9Asset(side.asset) || side.asset.media.type !== 'image' || !side.asset.media.url
        || !Number.isSafeInteger(side.asset.media.width) || side.asset.media.width <= 0
        || !Number.isSafeInteger(side.asset.media.height) || side.asset.media.height <= 0
        || !(side.crop === null || exact(side.crop, ['x', 'y', 'zoom']) && number(side.crop.x, 0, 1) && number(side.crop.y, 0, 1) && number(side.crop.zoom, 1, 4))
        || !exact(side.transform, ['quarterTurns', 'mirrorX', 'mirrorY'])
        || !Number.isInteger(side.transform.quarterTurns) || !number(side.transform.quarterTurns, 0, 3)
        || typeof side.transform.mirrorX !== 'boolean' || typeof side.transform.mirrorY !== 'boolean') return false;
      sides.add(side.id); return true;
    });
  });
}
export const imageReferenceCount = items => Array.isArray(items) ? items.reduce((sum, item) => sum + (Array.isArray(item?.sides) ? item.sides.length : 0), 0) : 0;
export const nextImageSide = (index, length) => length ? (index + 1) % length : 0;
export const projectImageModules = items => structuredClone(items.filter(item => item.visibility === 'PUBLIC').map(({ visibility, ...item }) => item));
export const restoreImageModules = (published = [], local = []) => structuredClone([
  ...published.map(item => ({ ...item, visibility: 'PUBLIC' })),
  ...local.filter(item => !published.some(other => other.id === item.id)).map(item => ({ ...item, visibility: 'PRIVATE' })),
]);
export const createImagePresentation = (id, index = 0) => ({ id, open: true, position: { left: 140 + index * 24, top: 100 + index * 24 } });
export function imageFocusEntry(side) {
  return { placement: { id: side.id, crop: side.crop, transform: side.transform,
    inspectionMode: 'LIFT' },
  media: { src: resolvePublishedAssetUrl(side.asset.media.url) }, focusDimensions: { width: side.asset.media.width, height: side.asset.media.height },
  accessibleLabel: side.asset.name || 'Artwork' };
}
