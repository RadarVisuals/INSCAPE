import { Extension } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { TextSelection } from '@tiptap/pm/state';
import { articleSpacingStyle, validArticleSpacing, validArticleLineHeight } from './domain/article.js';

const attributes = ['spaceBefore', 'spaceAfter', 'lineHeight'];
const isTextBlock = node => ['paragraph', 'heading'].includes(node.type.name);

// A saved paragraph can contain hard breaks or literal newlines. Only authored
// breaks define a separate line here; wrapping caused by the viewport does not.
export function articleLineToSeparate(selection) {
  const { $from, $to } = selection, node = $from.parent;
  if (!isTextBlock(node) || !$from.sameParent($to)) return null;
  const breaks = [];
  node.forEach((child, offset) => {
    if (child.type.name === 'hardBreak') breaks.push({ start: offset, end: offset + child.nodeSize });
    if (child.isText) for (const match of child.text.matchAll(/\r\n|\r|\n/g))
      breaks.push({ start: offset + match.index, end: offset + match.index + match[0].length });
  });
  if (!breaks.length || breaks.some(point => point.start < $from.parentOffset && point.end > $from.parentOffset)) return null;
  const before = breaks.findLast(point => point.end <= $from.parentOffset);
  const after = breaks.find(point => point.start >= $from.parentOffset);
  const start = before?.end ?? 0, end = after?.start ?? node.content.size;
  if ($from.parentOffset < start || $to.parentOffset > end) return null;
  return { node, position: $from.before(), start, end, before, after,
    from: $from.parentOffset - start, to: $to.parentOffset - start };
}

export function separateArticleLine(tr) {
  const line = articleLineToSeparate(tr.selection);
  if (!line) return false;
  const { node, position, start, end, before, after } = line;
  const pieces = [];
  if (before) pieces.push(node.content.cut(0, before.start));
  const selectedIndex = pieces.length;
  pieces.push(node.content.cut(start, end));
  if (after) pieces.push(node.content.cut(after.end));
  const blocks = pieces.map((content, index) => node.type.create({ ...node.attrs,
    spaceBefore: index === 0 ? node.attrs.spaceBefore : 0,
    spaceAfter: index === pieces.length - 1 ? node.attrs.spaceAfter : 0,
  }, content, node.marks));
  const selectedStart = position + blocks.slice(0, selectedIndex).reduce((size, block) => size + block.nodeSize, 0) + 1;
  closeHistory(tr);
  tr.replaceWith(position, position + node.nodeSize, blocks);
  tr.setSelection(TextSelection.create(tr.doc, selectedStart + line.from, selectedStart + line.to));
  return true;
}

export function selectedBlockSpacing(editor, name) {
  const values = new Set();
  const { from, to, empty, $from } = editor.state.selection;
  if (empty && isTextBlock($from.parent)) values.add($from.parent.attrs[name] ?? null);
  else if (!empty) editor.state.doc.nodesBetween(from, to, node => {
    if (isTextBlock(node)) values.add(node.attrs[name] ?? null);
  });
  return { value: values.size === 1 ? [...values][0] : null, mixed: values.size > 1,
    hasOverride: [...values].some(value => value != null), available: values.size > 0 };
}

export function captureArticleSpacing(editor, name) {
  const { from, to, empty, $from } = editor.state.selection, blocks = [];
  if (empty && isTextBlock($from.parent)) blocks.push({ position: $from.before(), value: $from.parent.attrs[name] });
  else if (!empty) editor.state.doc.nodesBetween(from, to, (node, position) => {
    if (isTextBlock(node)) blocks.push({ position, value: node.attrs[name] });
  });
  return () => {
    if (editor.isDestroyed || editor.state.selection.from !== from || editor.state.selection.to !== to) return;
    const tr = closeHistory(editor.state.tr);
    for (const { position, value } of blocks) {
      const node = tr.doc.nodeAt(position);
      if (node && isTextBlock(node)) tr.setNodeMarkup(position, undefined, { ...node.attrs, [name]: value });
    }
    editor.view.dispatch(tr);
  };
}

export const ArticleSpacing = Extension.create({
  name: 'articleSpacing',
  addGlobalAttributes() {
    return [{ types: ['paragraph', 'heading'], attributes: Object.fromEntries(attributes.map(name => [name, {
      default: null,
      renderHTML: attrs => attrs[name] == null ? {} : ({ style: Object.entries(articleSpacingStyle({ [name]: attrs[name] }))
        .map(([key, value]) => `${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}: ${value}${key === 'lineHeight' ? '' : 'px'}`).join('; ') }),
    }])) }];
  },
  addCommands() {
    return { separateArticleLine: () => ({ tr, dispatch }) => dispatch ? separateArticleLine(tr) : Boolean(articleLineToSeparate(tr.selection)),
      setArticleSpacing: (name, value) => ({ commands, tr }) => {
      if (!attributes.includes(name) || value !== null && !(name === 'lineHeight' ? validArticleLineHeight(value) : validArticleSpacing(value))) return false;
      closeHistory(tr);
      const paragraphs = commands.updateAttributes('paragraph', { [name]: value });
      const headings = commands.updateAttributes('heading', { [name]: value });
      return paragraphs || headings;
    } };
  },
});
