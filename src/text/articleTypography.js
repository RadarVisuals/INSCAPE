import { Extension } from '@tiptap/core';
import { TextStyle } from '@tiptap/extension-text-style';
import { closeHistory } from '@tiptap/pm/history';
import { validArticleFontSize, validArticleTracking } from './domain/article.js';

const properties = {
  fontSize: { css: 'font-size', unit: 'px', valid: validArticleFontSize },
  letterSpacing: { css: 'letter-spacing', unit: 'em', valid: validArticleTracking },
};

// The stock cleanup treats numeric zero as empty. Tracking 0 is an explicit
// value, so all typography commands use this null-aware cleanup instead.
export const ArticleTextStyle = TextStyle.extend({
  addCommands() {
    return { ...this.parent?.(), removeEmptyTextStyle: () => ({ tr }) => {
      const { from, to, empty, $from } = tr.selection;
      const hasStyle = marks => marks.some(mark => mark.type === this.type && Object.values(mark.attrs).some(value => value != null && value !== ''));
      if (empty) {
        if (!hasStyle(tr.storedMarks || $from.marks())) tr.removeStoredMark(this.type);
      } else tr.doc.nodesBetween(from, to, (node, pos) => {
        if (node.isInline && !hasStyle(node.marks)) tr.removeMark(Math.max(pos, from), Math.min(pos + node.nodeSize, to), this.type);
      });
      return true;
    } };
  },
});

// Numeric authored values share the article validator and remain independent of
// document size and Workbench zoom. TextStyle still owns the combined mark.
export const ArticleTypography = Extension.create({
  name: 'articleTypography',
  addGlobalAttributes() {
    return [{ types: ['textStyle'], attributes: Object.fromEntries(Object.entries(properties).map(([name, property]) => [name, {
      default: null,
      parseHTML: element => {
        const raw = element.style.getPropertyValue(property.css);
        const value = raw.endsWith(property.unit) ? Number(raw.slice(0, -property.unit.length)) : NaN;
        return property.valid(value) ? value : null;
      },
      renderHTML: attrs => attrs[name] == null ? {} : { style: `${property.css}: ${attrs[name]}${property.unit}` },
    }])) }];
  },
  addCommands() {
    return { setArticleTypography: (name, value) => ({ chain, tr }) => {
      const property = properties[name];
      if (!property || value !== null && !property.valid(value)) return false;
      closeHistory(tr);
      return chain().setMark('textStyle', { [name]: value }).removeEmptyTextStyle().run();
    } };
  },
});

export function selectedTypography(editor, name) {
  const { from, to, empty } = editor.state.selection;
  const values = new Set();
  if (empty) values.add(editor.getAttributes('textStyle')[name] ?? null);
  else editor.state.doc.nodesBetween(from, to, node => {
    if (node.isText) values.add(node.marks.find(mark => mark.type.name === 'textStyle')?.attrs[name] ?? null);
  });
  return { value: values.size === 1 ? [...values][0] : null, mixed: values.size > 1,
    hasOverride: [...values].some(value => value != null) };
}

// A mixed selection cannot be restored by applying one numeric value. Retain
// its original marks only for the lifetime of the numeric field interaction.
export function captureArticleTypography(editor) {
  const { from, to, empty } = editor.state.selection, type = editor.schema.marks.textStyle;
  const stored = empty ? (editor.state.storedMarks || editor.state.selection.$from.marks()).find(mark => mark.type === type) : null;
  const ranges = [];
  if (!empty) editor.state.doc.nodesBetween(from, to, (node, position) => {
    if (node.isText) ranges.push({ from: Math.max(from, position), to: Math.min(to, position + node.nodeSize), mark: node.marks.find(mark => mark.type === type) });
  });
  return () => {
    if (editor.isDestroyed || editor.state.selection.from !== from || editor.state.selection.to !== to) return;
    const tr = closeHistory(editor.state.tr);
    if (empty) { tr.removeStoredMark(type); if (stored) tr.addStoredMark(stored); }
    for (const range of ranges) { tr.removeMark(range.from, range.to, type); if (range.mark) tr.addMark(range.from, range.to, range.mark); }
    editor.view.dispatch(tr);
  };
}
