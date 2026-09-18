import { validateProfileDocumentV9Asset } from '../../profileDocument/domain/profileDocumentV9Asset.js';
import { validModuleEdges, moduleEdgeStyle } from '../../systemWorkflow/domain/moduleSurfaceAppearance.js';

export const ARTICLE_TYPE = 'INSCAPEArticle';
export const ARTICLE_MAX_BYTES = 192 * 1024;
export const MAX_TEXT_MODULES = 4;
export const defaultTextAppearance = () => ({ background: null, opacity: 1, frame: false, scale: 1, fontSize: 16, color: '#ffffff' });
export const textAppearance = article => article.appearance || { ...defaultTextAppearance(), background: '#101111', frame: true };
export function textContentStyle(article) {
  const padding = article.appearance?.padding;
  return padding ? { padding: `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`, maxWidth: 'none' } : {};
}
export function textSurfaceStyle(article) {
  if (!article.appearance) return { background: 'var(--workflow-panel)', color: 'var(--workflow-ink)', boxShadow: 'inset 0 0 0 1px var(--workflow-border)' };
  const appearance = textAppearance(article);
  const hex = appearance.background;
  const background = hex ? `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${appearance.opacity})` : 'transparent';
  return { background, color: appearance.color, ...moduleEdgeStyle(appearance.edges), boxShadow: [appearance.frame ? `inset 0 0 0 1px ${appearance.color}` : '', appearance.edges?.shadow ? 'var(--workflow-window-chrome-shadow)' : ''].filter(Boolean).join(', ') || 'none' };
}
export function textOutputStyle(article, window) {
  const transform = article.appearance?.transform;
  if (!transform) return textSurfaceStyle(article);
  const rotated = transform.quarterTurns % 2 === 1;
  return { ...textSurfaceStyle(article), position: 'absolute', left: '50%', top: '50%',
    width: rotated ? window.height : window.width, height: rotated ? window.width : window.height,
    transform: `translate(-50%, -50%) rotate(${transform.quarterTurns * 90}deg) scale(${transform.mirrorX ? -1 : 1}, ${transform.mirrorY ? -1 : 1})` };
}
export const TEXT_ID = /^text:[A-Za-z0-9_-]{1,80}$/u;
export const ARTICLE_ALIGNMENTS = Object.freeze(['left', 'center', 'right', 'justify-left', 'justify-center', 'justify-right', 'justify-all']);
export function articleAlignmentStyle(alignment) {
  if (!ARTICLE_ALIGNMENTS.includes(alignment)) return {};
  if (!alignment.startsWith('justify-')) return { textAlign: alignment, textAlignLast: 'auto' };
  return { textAlign: 'justify', textAlignLast: alignment === 'justify-all' ? 'justify' : alignment.slice(8) };
}
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
  if (!exact(article, ['documentType', 'version', 'title', 'font', 'content'], ['appearance']) || article.documentType !== ARTICLE_TYPE
    || article.version !== 1 || !string(article.title, 160) || !ARTICLE_FONTS.some(f => f.id === article.font)) throw new Error('Unsupported article format. The source has not been changed.');
  if (article.appearance !== undefined) {
    const a = article.appearance;
    if (!exact(a, ['background', 'opacity', 'frame', 'scale', 'fontSize', 'color'], ['transform', 'compact', 'padding', 'edges', 'titleFontSize'])
      || !(a.background === null || /^#[\da-f]{6}$/iu.test(a.background)) || !/^#[\da-f]{6}$/iu.test(a.color)
      || !Number.isFinite(a.opacity) || a.opacity < 0 || a.opacity > 1 || typeof a.frame !== 'boolean'
      || !Number.isFinite(a.scale) || a.scale < .01 || a.scale > 100
      || !Number.isFinite(a.fontSize) || a.fontSize < 8 || a.fontSize > 300
      || (a.titleFontSize !== undefined && (!Number.isFinite(a.titleFontSize) || a.titleFontSize < 8 || a.titleFontSize > 300))) throw new Error('Unsupported Text appearance.');
    if (a.edges !== undefined && !validModuleEdges(a.edges)) throw new Error('Unsupported Text edges.');
    if (a.compact !== undefined && typeof a.compact !== 'boolean') throw new Error('Unsupported Text spacing.');
    if (a.padding !== undefined && (!exact(a.padding, ['top', 'right', 'bottom', 'left'])
      || Object.values(a.padding).some(value => !Number.isFinite(value) || value < 0 || value > 512))) throw new Error('Unsupported Text inner spacing.');
    if (a.transform !== undefined && (!exact(a.transform, ['quarterTurns', 'mirrorX', 'mirrorY']) || ![0, 1, 2, 3].includes(a.transform.quarterTurns)
      || typeof a.transform.mirrorX !== 'boolean' || typeof a.transform.mirrorY !== 'boolean')) throw new Error('Unsupported Text transform.');
  }
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
    if (['paragraph', 'heading'].includes(type)) {
      if (type === 'heading' && (!exact(node.attrs, ['level'], ['textAlign']) || ![1, 2, 3].includes(node.attrs.level))) throw new Error('Unsupported heading.');
      if (type === 'paragraph' && node.attrs && !exact(node.attrs, [], ['textAlign'])) throw new Error('Unsupported paragraph attributes.');
      if (node.attrs?.textAlign != null && !ARTICLE_ALIGNMENTS.includes(node.attrs.textAlign)) throw new Error('Unsupported paragraph alignment.');
    }
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
  return { documentType: ARTICLE_TYPE, version: 1, title, font: 'sora', content: { type: 'doc', content: [{ type: 'paragraph' }] }, appearance: defaultTextAppearance() };
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
