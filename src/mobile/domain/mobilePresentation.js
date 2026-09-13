import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';
import { isValidPlacementMedia } from '../../systemWorkflow/domain/placementMedia.js';
import { validateProfileDocumentV9Asset, createProfileDocumentV9AssetResolver } from '../../profileDocument/domain/profileDocumentV9Asset.js';

export const MOBILE_CANVAS = Object.freeze({ width: 1080, height: 1920 });
export const MOBILE_MAX_ENTRIES = 64;
export const mobileTransform = (front, slot) => front.transforms?.[slot] || { quarterTurns: 0, mirrorX: false, mirrorY: false };
export const mobileTransformCss = t => `rotate(${t.quarterTurns * 90}deg) scale(${t.mirrorX ? -1 : 1},${t.mirrorY ? -1 : 1})`;
export function upgradeMobilePresentation(input) {
  const mobile = structuredClone(input);
  if (mobile.version === 1) {
    mobile.version = 2;
    mobile.front.transforms = Object.fromEntries(['background', 'artwork', 'mask'].map(slot => [slot, mobileTransform(mobile.front, slot)]));
  }
  return mobile;
}
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const number = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
const text = (v, max) => typeof v === 'string' && v.length <= max && !/[\u0000-\u001f\u007f]/u.test(v);
const color = v => typeof v === 'string' && /^#[0-9a-f]{6}$/iu.test(v);
const position = v => exact(v, ['x', 'y']) && number(v.x, .06, .94) && number(v.y, .05, .95);
export function validMobileReference(v, published = false) {
  return published ? validateProfileDocumentV9Asset(v) && v.media.type === 'image' && Boolean(v.media.url)
    : exact(v, ['stableAssetId', 'selectedMedia']) && Boolean(parseCanonicalAssetId(v.stableAssetId))
      && (v.selectedMedia === null || isValidPlacementMedia(v.selectedMedia));
}
export function validMobilePresentation(v, published = false) {
  if (!exact(v, ['version', 'canvas', 'theme', 'front', 'index', ...(!published ? ['visibility', 'editor'] : [])])
    || ![1, 2].includes(v.version) || !exact(v.canvas, ['width', 'height']) || v.canvas.width !== 1080 || v.canvas.height !== 1920
    || !['dark', 'light'].includes(v.theme)) return false;
  if (!published && (!['PRIVATE', 'PUBLIC'].includes(v.visibility) || !exact(v.editor, ['open']) || typeof v.editor.open !== 'boolean')) return false;
  const f = v.front;
  if (!exact(f, ['renderer', 'color', 'background', 'artwork', 'mask', 'image', 'border', 'positions', ...(v.version === 2 ? ['transforms'] : [])]) || !['assets', 'steyra'].includes(f.renderer) || !color(f.color)
    || ['background', 'artwork', 'mask'].some(k => f[k] !== null && !validMobileReference(f[k], published))
    || !exact(f.image, ['x', 'y', 'scale', 'fit']) || !number(f.image.x, -1, 2) || !number(f.image.y, -1, 2)
    || !number(f.image.scale, .1, 4) || !['contain', 'cover'].includes(f.image.fit)
    || !exact(f.border, ['width', 'color']) || !number(f.border.width, 0, 12) || !color(f.border.color)
    || !exact(f.positions, ['name', 'brand', 'theme', 'flip', 'share']) || !Object.values(f.positions).every(position)) return false;
  if (v.version === 2 && (!exact(f.transforms, ['background', 'artwork', 'mask']) || !Object.values(f.transforms).every(t =>
    exact(t, ['quarterTurns', 'mirrorX', 'mirrorY']) && Number.isInteger(t.quarterTurns) && number(t.quarterTurns, 0, 3)
    && typeof t.mirrorX === 'boolean' && typeof t.mirrorY === 'boolean'))) return false;
  const index = v.index;
  if (!exact(index, ['title', 'intro', 'entries']) || !text(index.title, 80) || !text(index.intro, 240)
    || !Array.isArray(index.entries) || index.entries.length > MOBILE_MAX_ENTRIES) return false;
  const ids = new Set();
  return index.entries.every(entry => {
    if (!exact(entry, ['id', 'asset']) || !/^mobile-entry:[a-zA-Z0-9_-]{1,80}$/u.test(entry.id)
      || ids.has(entry.id) || !validMobileReference(entry.asset, published)) return false;
    ids.add(entry.id); return true;
  });
}
export function createMobilePresentation() {
  return { version: 1, canvas: { ...MOBILE_CANVAS }, theme: 'dark', visibility: 'PRIVATE', editor: { open: true },
    front: { renderer: 'assets', color: '#151515', background: null, artwork: null, mask: null,
      image: { x: .5, y: .5, scale: 1, fit: 'contain' }, border: { width: 0, color: '#999999' },
      positions: { name: { x: .22, y: .9 }, brand: { x: .22, y: .08 },
        theme: { x: .88, y: .84 }, flip: { x: .88, y: .91 }, share: { x: .9, y: .08 } } },
    index: { title: 'The works', intro: '', entries: [] } };
}
export function mobileReferenceCount(mobile) {
  return mobile ? ['background', 'artwork', 'mask'].filter(k => mobile.front?.[k]).length + (mobile.index?.entries?.length || 0) : 0;
}
export function projectMobilePresentation(mobile, assets) {
  if (!validMobilePresentation(mobile)) throw new TypeError('Invalid Mobile presentation');
  const resolve = createProfileDocumentV9AssetResolver(assets, { compactContentReference: false });
  const ref = value => {
    if (!value) return null;
    const asset = resolve(value.stableAssetId, value.selectedMedia);
    if (asset.media.type !== 'image' || !asset.media.url) throw new TypeError('Mobile currently supports image assets only.');
    return asset;
  };
  const { visibility, editor, ...content } = structuredClone(mobile);
  for (const key of ['background', 'artwork', 'mask']) content.front[key] = ref(mobile.front[key]);
  content.index.entries = mobile.index.entries.map(entry => ({ id: entry.id, asset: ref(entry.asset) }));
  return content;
}
export function restoreMobilePresentation(published, previous) {
  const ref = asset => asset ? { stableAssetId: asset.stableAssetId, selectedMedia: {
    url: asset.media.url, width: asset.media.width, height: asset.media.height } } : null;
  const mobile = structuredClone(published);
  for (const key of ['background', 'artwork', 'mask']) mobile.front[key] = ref(published.front[key]);
  mobile.index.entries = published.index.entries.map(entry => ({ id: entry.id, asset: ref(entry.asset) }));
  return { ...mobile, visibility: 'PUBLIC', editor: previous?.editor || { open: false } };
}
