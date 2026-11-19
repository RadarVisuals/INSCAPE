import { Mark, mergeAttributes, isMarkActive } from '@tiptap/core';
import { safeArticleLink } from './domain/article.js';

// Article links are explicit edits. Keep their native mark/selection semantics
// without loading URL detection, automatic paste rules or click navigation.
export const ArticleLink = Mark.create({
  name: 'link',
  priority: 1000,
  keepOnSplit: false,
  exitable: true,
  inclusive: false,
  addAttributes() {
    return {
      href: { default: null },
      target: { default: '_blank' },
      rel: { default: 'noopener noreferrer nofollow' },
      class: { default: null },
      title: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'a[href]', getAttrs: element => safeArticleLink(element.getAttribute('href')) ? null : false }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes(HTMLAttributes, {
      href: safeArticleLink(HTMLAttributes.href) ? HTMLAttributes.href : '',
    }), 0];
  },
  addCommands() {
    return {
      setLink: attributes => ({ commands }) => safeArticleLink(attributes?.href)
        && commands.setMark(this.name, attributes),
      toggleLink: attributes => ({ commands, state }) => {
        if (attributes?.href != null ? !safeArticleLink(attributes.href) : !isMarkActive(state, this.name)) return false;
        return commands.toggleMark(this.name, attributes, { extendEmptyMarkRange: true });
      },
      unsetLink: () => ({ commands }) => commands.unsetMark(this.name, { extendEmptyMarkRange: true }),
    };
  },
});
