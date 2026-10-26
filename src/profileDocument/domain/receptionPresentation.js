import { validImageModules, projectImageModules, restoreImageModules, imageReferenceCount } from '../../imageModule/imageModule.js';
import { validTextModules, projectTextModules, restoreTextModules } from '../../text/domain/article.js';

export const RECEPTION_EXTENT = 10000;
export const RECEPTION_MIN = 200;
export const RECEPTION_LIMIT = 32;
const E = RECEPTION_EXTENT;
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const number = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
const integer = (v, min, max) => Number.isInteger(v) && number(v, min, max);
const colour = v => v === null || typeof v === 'string' && /^#[0-9a-f]{6}$/iu.test(v);
export const RECEPTION_PROFILE_CONTENT = Object.freeze(['profile', 'links', 'introduction', 'details']);
const builtins = new Set(RECEPTION_PROFILE_CONTENT);
export const newReceptionRegion = (id = `region:${crypto.randomUUID()}`) => ({ id, x: 0, y: 0, width: E, height: E, content: null,
  padding: null, alignX: 'left', alignY: 'top', surface: null });
export const createReception = () => {
  const region = newReceptionRegion();
  return { version: 2, regions: [region], imageModules: [], texts: [], mobile: [{ id: region.id, columns: 2, height: 320 }],
    radius: 20, gutter: 8, padding: 24, height: 900, branding: { name: '', logo: null, theme: 'carbon' } };
};
export function validReception(value, published = false) {
  if (!exact(value, ['version', 'regions', 'imageModules', 'texts', 'mobile', 'radius', 'gutter', 'padding', 'height', 'branding'])
    || value.version !== 2 || !number(value.radius, 0, 160) || !number(value.gutter, 0, 64) || !number(value.padding, 0, 128)
    || !integer(value.height, 480, 2400) || !validImageModules(value.imageModules, published) || !validTextModules(value.texts, published)
    || value.texts.some(text => text.sceneLink || text.pagination)
    || !exact(value.branding, ['name', 'logo', 'theme']) || typeof value.branding.name !== 'string'
    || value.branding.name.length > 64 || /[\u0000-\u001f\u007f]/u.test(value.branding.name) || !['carbon', 'mist'].includes(value.branding.theme)
    || value.branding.logo !== null && !value.imageModules.some(item => item.id === value.branding.logo)
    || !Array.isArray(value.regions) || !value.regions.length || value.regions.length > RECEPTION_LIMIT) return false;
  const ids = new Set(), placed = new Set(), content = new Set([...builtins, ...value.imageModules.map(i => i.id), ...value.texts.map(i => i.id)]);
  let area = 0;
  for (const r of value.regions) {
    if (!exact(r, ['id', 'x', 'y', 'width', 'height', 'content', 'padding', 'alignX', 'alignY', 'surface'])
      || typeof r.id !== 'string' || !/^region:[A-Za-z0-9_-]{1,80}$/u.test(r.id) || ids.has(r.id)
      || !integer(r.x, 0, E) || !integer(r.y, 0, E) || !integer(r.width, RECEPTION_MIN, E) || !integer(r.height, RECEPTION_MIN, E)
      || r.x + r.width > E || r.y + r.height > E || r.padding !== null && !number(r.padding, 0, 128) || !colour(r.surface)
      || !['left', 'center', 'right'].includes(r.alignX) || !['top', 'center', 'bottom'].includes(r.alignY)
      || r.content !== null && (!content.has(r.content) || !builtins.has(r.content) && placed.has(r.content))) return false;
    for (const other of value.regions) {
      if (!other || typeof other !== 'object') return false;
      if (other !== r && Math.max(r.x, other.x) < Math.min(r.x + r.width, other.x + other.width)
        && Math.max(r.y, other.y) < Math.min(r.y + r.height, other.y + other.height)) return false;
    }
    ids.add(r.id); if (r.content) placed.add(r.content); area += r.width * r.height;
  }
  if (area !== E * E || !Array.isArray(value.mobile) || value.mobile.length !== ids.size) return false;
  const mobile = new Set();
  for (const r of value.mobile) {
    if (!exact(r, ['id', 'columns', 'height']) || !ids.has(r.id) || mobile.has(r.id) || ![1, 2].includes(r.columns) || !integer(r.height, 80, 1200)) return false;
    mobile.add(r.id);
  }
  if (published && [...value.texts, ...value.imageModules].some(item => !placed.has(item.id) && item.id !== value.branding.logo)) return false;
  return true;
}
export function assertReception(value) {
  if (!validReception(value)) throw new Error('The Reception layout or content is invalid. Your saved layout is unchanged.');
  return value;
}
export function projectReception(value) {
  if (!value) return undefined;
  const used = new Set(value.regions.map(r => r.content).filter(Boolean));
  if (value.branding.logo) used.add(value.branding.logo);
  // Also accepts a verified public shared section during selective publication.
  const project = (items, fn) => fn(items.filter(i => used.has(i.id)).map(i => ({ ...i, visibility: i.visibility || 'PUBLIC' })));
  const imageModules = project(value.imageModules, projectImageModules), texts = project(value.texts, projectTextModules);
  const allowed = new Set([...builtins, ...imageModules.map(i => i.id), ...texts.map(i => i.id)]);
  return structuredClone({ ...value, imageModules, texts, regions: value.regions.map(r => ({ ...r, content: allowed.has(r.content) ? r.content : null })),
    branding: { ...value.branding, logo: imageModules.some(i => i.id === value.branding.logo) ? value.branding.logo : null } });
}
export const restoreReception = value => value ? { ...structuredClone(value), imageModules: restoreImageModules(value.imageModules), texts: restoreTextModules(value.texts) } : undefined;
export function receptionReferenceCount(value) {
  const count = node => node?.type === 'artwork' ? 1 : Array.isArray(node?.content) ? node.content.reduce((sum, child) => sum + count(child), 0) : 0;
  return imageReferenceCount(value?.imageModules) + (Array.isArray(value?.texts) ? value.texts : []).reduce((sum, item) => sum + count(item?.article?.content), 0);
}
