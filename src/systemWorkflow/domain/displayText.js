import { ARTICLE_FONTS, ARTICLE_ALIGNMENTS, assertArticle, createArticle, textAppearance } from '../../text/domain/article.js';

export const DISPLAY_TEXT_KEYS = ['id', 'kind', 'text', 'column', 'row', 'columnSpan', 'rowSpan', 'layer', 'navigationOrder', 'visibility', 'transform'];
export const isTextPlacement = placement => placement?.kind === 'text';
export function validDisplayText(value) {
  if (value?.article) {
    try { return Object.keys(value).length === 1 && Boolean(assertArticle(value.article)); } catch { return false; }
  }
  const keys = ['content', 'font', 'size', 'color', 'alignment', 'bold', 'italic'];
  return Boolean(value && typeof value === 'object' && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
    && typeof value.content === 'string' && value.content.length <= 4000 && !/[\u0000-\u0008\u000b-\u001f\u007f]/u.test(value.content)
    && ARTICLE_FONTS.some(font => font.id === value.font) && Number.isFinite(value.size) && value.size >= 8 && value.size <= 300
    && /^#[0-9a-f]{6}$/iu.test(value.color) && ARTICLE_ALIGNMENTS.includes(value.alignment)
    && typeof value.bold === 'boolean' && typeof value.italic === 'boolean');
}

export function displayTextArticle(text) {
  if (text.article) return text.article;
  const article = createArticle();
  article.font = text.font;
  article.appearance = { ...textAppearance(article), fontSize: text.size, color: text.color, compact: true };
  const marks = [...(text.bold ? [{ type: 'bold' }] : []), ...(text.italic ? [{ type: 'italic' }] : [])];
  const content = text.content.split('\n').flatMap((line, index) => [...(index ? [{ type: 'hardBreak' }] : []), ...(line ? [{ type: 'text', text: line, ...(marks.length ? { marks } : {}) }] : [])]);
  article.content.content = [{ type: 'paragraph', attrs: { textAlign: text.alignment }, ...(content.length ? { content } : {}) }];
  return article;
}
export function displayTextLabel(text) {
  if (!text.article) return text.content || 'Empty text';
  const plain = node => node.text || (node.content || []).map(plain).join(' ');
  return text.article.title || plain(text.article.content).trim().slice(0, 80) || 'Empty text';
}
