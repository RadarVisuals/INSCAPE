import { Extension } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { ARTICLE_ALIGNMENTS, articleAlignmentStyle } from './domain/article.js';

// One authored value controls both the paragraph and its last line in every view.
export const ArticleAlignment = Extension.create({
  name: 'articleAlignment',
  addGlobalAttributes() {
    return [{ types: ['paragraph', 'heading'], attributes: {
      textAlign: {
        default: null,
        renderHTML: attributes => {
          const style = articleAlignmentStyle(attributes.textAlign);
          return style.textAlign ? { style: `text-align: ${style.textAlign}; text-align-last: ${style.textAlignLast}` } : {};
        },
      },
    } }];
  },
  addCommands() {
    return { setArticleAlignment: alignment => ({ commands, tr }) => {
      if (!ARTICLE_ALIGNMENTS.includes(alignment)) return false;
      closeHistory(tr);
      const paragraphs = commands.updateAttributes('paragraph', { textAlign: alignment });
      const headings = commands.updateAttributes('heading', { textAlign: alignment });
      return paragraphs || headings;
    } };
  },
});
