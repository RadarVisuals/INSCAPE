import { defaults, validate } from '../../../packages/mirror/core.js';
import { validateProfileDocumentV9Asset } from '../../profileDocument/domain/profileDocumentV9Asset.js';

export const MAX_MIRROR_MODULES = 4;
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const number = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
const same = (a, b) => a && typeof a === 'object' ? exact(b, Object.keys(a)) && Object.keys(a).every(k => same(a[k], b[k])) : a === b;
export function validMirrorModules(items, published = false) {
  if (!Array.isArray(items) || items.length > MAX_MIRROR_MODULES) return false;
  const ids = new Set();
  return items.every(item => {
    if (!exact(item, ['id', 'name', 'asset', 'settings', 'presentation', ...(!published ? ['visibility'] : [])])
      || !/^mirror:[A-Za-z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id)
      || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 48 || /[\u0000-\u001f\u007f]/u.test(item.name)
      || !published && !['PRIVATE', 'PUBLIC'].includes(item.visibility)) return false;
    ids.add(item.id);
    if (!(item.asset === null && !published) && !(validateProfileDocumentV9Asset(item.asset)
      && item.asset.media.type === 'image' && typeof item.asset.media.url === 'string')) return false;
    const p = item.presentation, w = p?.window;
    if (!exact(p, ['open', 'window']) || typeof p.open !== 'boolean'
      || !exact(w, ['left', 'top', 'width', 'height']) || !number(w.left, 0, 16384) || !number(w.top, 0, 16384)
      || !number(w.width, 180, 16384) || !number(w.height, 100, 16384)) return false;
    try {
      const settings = validate(item.settings);
      // The host owns the asset reference; settings may not hide extra data.
      return settings.assetRef === null && same(settings, item.settings);
    } catch { return false; }
  });
}
export function createMirrorRecord(index = 0) {
  return { id: `mirror:${crypto.randomUUID()}`, name: `MIRROR ${index + 1}`, visibility: 'PRIVATE',
    asset: null, settings: validate(defaults()),
    presentation: { open: true, window: { left: 80 + index * 32, top: 80 + index * 24, width: 880, height: 600 } } };
}
