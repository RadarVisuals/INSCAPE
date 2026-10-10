export const MAX_SHAPES = 32;
export const SHAPE_ID = /^shape:[A-Za-z0-9_-]{1,80}$/u;
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

// Array order owns stacking, back to front. Shapes occupy a background band
// below content windows, independent of tool focus.
export function validShapes(items, published = false) {
  if (!Array.isArray(items) || items.length > MAX_SHAPES) return false;
  const ids = new Set();
  return items.every(item => {
    if (!exact(item, ['id', 'name', 'color', 'opacity', ...(Object.hasOwn(item || {}, 'grain') ? ['grain'] : []), ...(!published ? ['visibility'] : [])])
      || !SHAPE_ID.test(item.id) || ids.has(item.id)
      || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 48 || /[\u0000-\u001f\u007f]/u.test(item.name)
      || !/^#[0-9a-f]{6}$/iu.test(item.color) || !Number.isFinite(item.opacity) || item.opacity < 0 || item.opacity > 1
      || Object.hasOwn(item, 'grain') && (!Number.isFinite(item.grain) || item.grain < 0 || item.grain > 1)
      || !published && !['PRIVATE', 'PUBLIC'].includes(item.visibility)) return false;
    ids.add(item.id); return true;
  });
}
export const createShapePresentation = (id, index = 0) => ({ id, open: true,
  window: { left: 120 + index * 24, top: 120 + index * 24, width: 288, height: 288 } });
export const projectShapes = items => structuredClone(items.filter(item => item.visibility === 'PUBLIC').map(({ visibility, ...item }) => item));
export const restoreShapes = (published = [], local = []) => structuredClone([
  ...published.map(item => ({ ...item, visibility: 'PUBLIC' })),
  ...local.filter(item => !published.some(other => other.id === item.id)).map(item => ({ ...item, visibility: 'PRIVATE' })),
]);
