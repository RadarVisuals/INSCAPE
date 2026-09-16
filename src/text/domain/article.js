import { validateProfileDocumentV9Asset } from '../../profileDocument/domain/profileDocumentV9Asset.js';

export const ARTICLE_TYPE = 'INSCAPEArticle';
export const ARTICLE_MAX_BYTES = 192 * 1024;
export const MAX_TEXT_MODULES = 4;
export const TEXT_ID = /^text:[A-Za-z0-9_-]{1,80}$/u;
export const ARTICLE_FONTS = Object.freeze([
  { id: 'sora', label: 'Sora', family: 'Inscape Sora', directory: 'Sora', file: 'Sora-VariableFont_wght.ttf' },
  { id: 'plex', label: 'IBM Plex Sans Condensed', family: 'Inscape IBM Plex Sans Condensed', directory: 'IBM_Plex_Sans_Condensed', file: 'IBMPlexSansCondensed-Regular.ttf' },
  { id: 'literata', label: 'Literata', family: 'Inscape Article Literata', directory: 'Literata', file: 'Literata.ttf' },
  { id: 'cormorant', label: 'Cormorant Garamond', family: 'Inscape Article Cormorant', directory: 'Cormorant', file: 'Cormorant.ttf' },
  { id: 'mono', label: 'IBM Plex Mono', family: 'Inscape Article Mono', directory: 'IBM_Plex_Mono', file: 'IBMPlexMono-Regular.ttf' },
]);
export const exact = (v, keys, optional = []) => Boolean(v && typeof v === 'object' && !Array.isArray(v)
  && keys.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => keys.includes(k) || optional.includes(k)));
const string = (v, max) => typeof v === 'string' && v.length <= max;
export function safeArticleLink(value) {
  if (!string(value, 2048) || /[\u0000-\u0020\u007f]/u.test(value)) return false;
  try { const u = new URL(value); return ['https:', 'mailto:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
}
const blocks = ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'horizontalRule', 'artwork'];
function validMark(mark) {
  if (['bold', 'italic', 'strike', 'underline', 'code'].includes(mark?.type)) return exact(mark, ['type']);
  if (mark?.type === 'textStyle') return exact(mark, ['type', 'attrs']) && exact(mark.attrs, ['fontFamily'])
    && ARTICLE_FONTS.some(font => font.family === mark.attrs.fontFamily);
  return mark?.type === 'link' && exact(mark, ['type', 'attrs']) && exact(mark.attrs, ['href'], ['target', 'rel', 'class'])
    && safeArticleLink(mark.attrs.href) && [undefined, null, '_blank', '_self'].includes(mark.attrs.target)
    && [undefined, null, 'noopener noreferrer nofollow', 'noopener noreferrer'].includes(mark.attrs.rel)
    && [undefined, null].includes(mark.attrs.class);
}
export function assertArticle(article) {
  if (!exact(article, ['documentType', 'version', 'title', 'font', 'content']) || article.documentType !== ARTICLE_TYPE
    || article.version !== 1 || !string(article.title, 160) || !ARTICLE_FONTS.some(f => f.id === article.font)) throw new Error('Unsupported article format. The source has not been changed.');
  let count = 0;
  function visit(node, parent, depth) {
    if (++count > 6000 || depth > 16 || !exact(node, ['type'], ['attrs', 'content', 'text', 'marks'])) throw new Error('Article structure exceeds supported limits.');
    const type = node.type;
    const allowed = parent === null ? ['doc'] : ['paragraph', 'heading'].includes(parent) ? ['text', 'hardBreak']
      : ['bulletList', 'orderedList'].includes(parent) ? ['listItem'] : blocks;
    if (!allowed.includes(type)) throw new Error(`Unsupported article block: ${String(type).slice(0, 40)}.`);
    if (type === 'text') {
      if (!string(node.text, ARTICLE_MAX_BYTES) || !node.text.length || node.content || node.attrs
        || node.marks && (!Array.isArray(node.marks) || node.marks.length > 7 || !node.marks.every(validMark))) throw new Error('Unsupported text formatting.');
      return;
    }
    if (node.text !== undefined || node.marks !== undefined) throw new Error('Invalid article block.');
    if (type === 'heading') { if (!exact(node.attrs, ['level']) || ![1, 2, 3].includes(node.attrs.level)) throw new Error('Unsupported heading.'); }
    else if (type === 'orderedList') { if (node.attrs && (!exact(node.attrs, ['start'], ['type']) || !Number.isSafeInteger(node.attrs.start)
      || node.attrs.start < 1 || node.attrs.start > 9999 || ![undefined, null].includes(node.attrs.type))) throw new Error('Unsupported list.'); }
    else if (type === 'artwork') {
      if (!exact(node.attrs, ['asset', 'alt', 'caption']) || !validateProfileDocumentV9Asset(node.attrs.asset)
        || node.attrs.asset.media.type !== 'image' || typeof node.attrs.asset.media.url !== 'string'
        || !string(node.attrs.alt, 1000) || !string(node.attrs.caption, 2000)) throw new Error('Invalid artwork reference.');
    } else if (node.attrs && Object.keys(node.attrs).length) throw new Error('Unsupported block attributes.');
    if (['hardBreak', 'horizontalRule', 'artwork'].includes(type)) { if (node.content !== undefined) throw new Error('Invalid leaf block.'); return; }
    if (node.content !== undefined && !Array.isArray(node.content)) throw new Error('Invalid article content.');
    if (['doc', 'blockquote', 'listItem', 'bulletList', 'orderedList'].includes(type) && !node.content?.length) throw new Error('Empty article structure.');
    if (type === 'listItem' && node.content[0].type !== 'paragraph') throw new Error('A list item must start with a paragraph.');
    for (const child of node.content || []) visit(child, type, depth + 1);
  }
  visit(article.content, null, 0);
  if (new TextEncoder().encode(JSON.stringify(article)).length > ARTICLE_MAX_BYTES) throw new Error('Article exceeds 192 KiB.');
  return article;
}
export function createArticle(title = '') {
  return { documentType: ARTICLE_TYPE, version: 1, title, font: 'sora', content: { type: 'doc', content: [{ type: 'paragraph' }] } };
}
export function validTextModules(items, published = false) {
  try {
    if (!Array.isArray(items) || items.length > MAX_TEXT_MODULES) return false;
    const ids = new Set();
    return items.every(item => {
      if (!exact(item, ['id', 'article', ...(!published ? ['visibility'] : [])], published ? [] : ['target']) || !TEXT_ID.test(item.id) || ids.has(item.id)) return false;
      ids.add(item.id); assertArticle(item.article);
      return published || ['PRIVATE', 'PUBLIC'].includes(item.visibility) && (item.target == null || validLegacyTarget(item.target));
    });
  } catch { return false; }
}
// Read compatibility only: old drafts may still contain an unused NFT binding.
function validLegacyTarget(t) {
  return exact(t, ['address', 'tokenId', 'metadataValue', 'assetIndex']) && /^0x[\da-f]{40}$/u.test(t.address)
    && /^0x[\da-f]{64}$/u.test(t.tokenId) && /^0x(?:[\da-f]{2})+$/iu.test(t.metadataValue) && t.metadataValue.length <= 8192
    && Number.isSafeInteger(t.assetIndex) && t.assetIndex >= -1 && t.assetIndex < 128;
}
export const projectTextModules = items => items.filter(i => i.visibility === 'PUBLIC').map(({ id, article }) => ({ id, article: structuredClone(article) }));
export const restoreTextModules = (published = [], local = []) => [
  ...published.map(i => ({ ...structuredClone(i), visibility: 'PUBLIC' })),
  ...local.filter(i => !published.some(p => p.id === i.id)).map(i => ({ ...structuredClone(i), visibility: 'PRIVATE' })),
];
