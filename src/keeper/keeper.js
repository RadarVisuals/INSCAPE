import { validateProfileDocumentV9Asset } from '../profileDocument/domain/profileDocumentV9Asset.js';
import { validKeeperSwim } from './keeperSwim.js';

export const MAX_KEEPER_DOCKS = 4;
export const KEEPER_ID = /^keeper:[A-Za-z0-9_-]{1,80}$/u;
export const KEEPER_DOCK_SIZE = { width: 72, height: 88 };
export const KEEPER_SIZE = Object.freeze({ min: 64, max: 384, default: 192, legacy: 128 });
export const keeperSize = record => record.size ?? KEEPER_SIZE.legacy;
// Omission is the original whole-image behavior; reading old drafts never rewrites them.
export const keeperMovement = record => record.movement ?? 'flip';
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
export const validKeeperAsset = asset => asset === null || validateProfileDocumentV9Asset(asset)
  && asset.media.type === 'image' && Boolean(asset.media.url)
  && Number.isSafeInteger(asset.media.width) && asset.media.width > 0
  && Number.isSafeInteger(asset.media.height) && asset.media.height > 0;
export function validKeeperDocks(items, published = false) {
  if (!Array.isArray(items) || items.length > MAX_KEEPER_DOCKS) return false;
  const ids = new Set();
  return items.every(item => {
    if (!exact(item, ['id', 'name', 'asset', 'faces', ...(!published ? ['visibility'] : []),
      ...['size', 'movement', 'swim'].filter(key => Object.hasOwn(item || {}, key))])
      || typeof item.id !== 'string' || !KEEPER_ID.test(item.id) || ids.has(item.id)
      || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 48 || /[\u0000-\u001f\u007f]/u.test(item.name)
      || !['left', 'right'].includes(item.faces) || !validKeeperAsset(item.asset)
      || !['flip', 'swim'].includes(keeperMovement(item)) || Object.hasOwn(item, 'movement') && item.movement == null
      || Object.hasOwn(item, 'swim') && !validKeeperSwim(item.swim)
      || Object.hasOwn(item, 'size') && (!Number.isSafeInteger(item.size) || item.size < KEEPER_SIZE.min || item.size > KEEPER_SIZE.max)
      || !published && !['PRIVATE', 'PUBLIC'].includes(item.visibility)) return false;
    ids.add(item.id); return true;
  });
}
export const keeperReferenceCount = items => Array.isArray(items) ? items.filter(item => item?.asset).length : 0;
export const createKeeperPresentation = (id, index = 0) => ({ id, position: { left: 24 + index * 88, top: 32 } });
export const projectKeeperDocks = items => structuredClone(items.filter(item => item.visibility === 'PUBLIC').map(({ visibility, ...item }) => item));
export const restoreKeeperDocks = (published = [], local = []) => structuredClone([
  ...published.map(item => ({ ...item, visibility: 'PUBLIC' })),
  ...local.filter(item => !published.some(other => other.id === item.id)).map(item => ({ ...item, visibility: 'PRIVATE' })),
]);
