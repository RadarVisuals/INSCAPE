import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { closeHistory } from '@tiptap/pm/history';
import { ARTICLE_MAX_BYTES, assertArticle } from './domain/article.js';

export const articleSearchKey = new PluginKey('articleSearch');

// Runs span adjacent text nodes (including differently marked text), but never
// a hard break, atom or block boundary. Positions remain document positions.
export function findArticleMatches(doc, query) {
  if (!query) return [];
  const matches = [];
  const expression = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
  doc.descendants((block, pos) => {
    if (!block.isTextblock) return;
    let run = '', start = 0;
    const flush = () => {
      expression.lastIndex = 0;
      for (const match of run.matchAll(expression)) matches.push({ from: start + match.index, to: start + match.index + match[0].length });
      run = '';
    };
    block.forEach((node, offset) => {
      if (!node.isText) { flush(); return; }
      if (!run) start = pos + 1 + offset;
      run += node.text;
    });
    flush();
    return false;
  });
  return matches;
}

const emptySearch = () => ({ open: false, query: '', matches: [], active: -1 });
export const ArticleSearchExtension = Extension.create({
  name: 'articleSearch',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: articleSearchKey,
      state: {
        init: emptySearch,
        apply(tr, previous) {
          const action = tr.getMeta(articleSearchKey);
          if (action?.close) return emptySearch();
          if (!action && !tr.docChanged) return previous;
          const query = action?.query ?? previous.query;
          const matches = query === previous.query && !tr.docChanged ? previous.matches : findArticleMatches(tr.doc, query);
          let active = action?.active ?? previous.active;
          if (query !== previous.query) active = 0;
          if (tr.docChanged && previous.matches[previous.active]) {
            const origin = tr.mapping.map(previous.matches[previous.active].from, 1);
            active = matches.findIndex(match => match.from >= origin);
            if (active < 0) active = 0;
          }
          return { open: action?.open ?? previous.open, query, matches, active: matches.length ? Math.max(0, Math.min(active, matches.length - 1)) : -1 };
        },
      },
      props: {
        decorations(state) {
          const search = articleSearchKey.getState(state);
          if (!search.open) return DecorationSet.empty;
          const start = Math.max(0, search.active - 250);
          return DecorationSet.create(state.doc, search.matches.slice(start, start + 500).map((match, offset) =>
            Decoration.inline(match.from, match.to, { class: `text-search-match${start + offset === search.active ? ' text-search-match--active' : ''}` })));
        },
      },
    })];
  },
});

export function setArticleSearch(editor, action) {
  if (editor.isDestroyed) return;
  editor.view.dispatch(editor.state.tr.setMeta(articleSearchKey, action).setMeta('addToHistory', false));
}

export function navigateArticleMatch(editor, direction) {
  const search = articleSearchKey.getState(editor.state);
  if (!editor.isEditable || !search.matches.length) return false;
  const active = (search.active + direction + search.matches.length) % search.matches.length;
  const match = search.matches[active];
  editor.view.dispatch(editor.state.tr.setMeta(articleSearchKey, { active })
    .setSelection(TextSelection.create(editor.state.doc, match.from, match.to)).setMeta('addToHistory', false).scrollIntoView());
  return true;
}

export function replaceArticleMatches(editor, replacement, all = false, article) {
  const search = articleSearchKey.getState(editor.state);
  if (!editor.isEditable || !search.open || search.active < 0) return false;
  const matches = all ? search.matches : [search.matches[search.active]];
  if (matches.length > 1000) throw new Error('Replace all supports up to 1,000 matches at once. Use a more specific search.');
  // Reject amplification before constructing a transaction. Exact validation
  // below also includes marks, nodes, assets and the article's appearance.
  const encoder = new TextEncoder();
  const jsonBytes = value => encoder.encode(JSON.stringify(value)).length;
  const original = { ...article, content: editor.getJSON() };
  const projected = jsonBytes(original) + matches.reduce((delta, match) => delta + jsonBytes(replacement)
    - jsonBytes(editor.state.doc.textBetween(match.from, match.to)), 0);
  if (projected > ARTICLE_MAX_BYTES) throw new Error('Replacement would exceed the article limit of 192 KiB. Use shorter text.');
  const tr = closeHistory(editor.state.tr);
  // Work backwards so the original ranges stay valid. Replacements take the
  // first matched character's marks; surrounding runs and links are unchanged.
  for (const match of [...matches].reverse()) {
    const marks = editor.state.doc.resolve(match.from).nodeAfter?.marks || [];
    if (replacement) tr.replaceWith(match.from, match.to, editor.schema.text(replacement, marks));
    else tr.delete(match.from, match.to);
  }
  if (article) assertArticle({ ...article, content: tr.doc.toJSON() });
  editor.view.dispatch(tr);
  // Isolate subsequent typing/replacements as well as preceding typing.
  editor.view.dispatch(closeHistory(editor.state.tr).setMeta('addToHistory', false));
  return true;
}
