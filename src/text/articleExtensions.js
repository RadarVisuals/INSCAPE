import { Bold } from '@tiptap/extension-bold';
import { Blockquote } from '@tiptap/extension-blockquote';
import { BulletList } from '@tiptap/extension-list/bullet-list';
import { Code } from '@tiptap/extension-code';
import { Document } from '@tiptap/extension-document';
import { Dropcursor } from '@tiptap/extensions/drop-cursor';
import { Gapcursor } from '@tiptap/extensions/gap-cursor';
import { HardBreak } from '@tiptap/extension-hard-break';
import { Heading } from '@tiptap/extension-heading';
import { UndoRedo } from '@tiptap/extensions/undo-redo';
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';
import { Italic } from '@tiptap/extension-italic';
import { ListItem } from '@tiptap/extension-list/item';
import { ListKeymap } from '@tiptap/extension-list/keymap';
import { Link } from '@tiptap/extension-link';
import { OrderedList } from '@tiptap/extension-list/ordered-list';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Strike } from '@tiptap/extension-strike';
import { Text } from '@tiptap/extension-text';
import { Underline } from '@tiptap/extension-underline';
import { TrailingNode } from '@tiptap/extensions/trailing-node';

// Preserve StarterKit's extension order, defaults and existing link options,
// while importing only the extensions used by the article editor.
export const articleExtensions = [
  Bold, Blockquote, BulletList, Code, Document, Dropcursor, Gapcursor,
  HardBreak, Heading.configure({ levels: [1, 2, 3] }), UndoRedo, HorizontalRule, Italic,
  ListItem, ListKeymap,
  Link.configure({ openOnClick: false, autolink: false, linkOnPaste: false, protocols: ['https', 'mailto'] }),
  OrderedList, Paragraph, Strike, Text, Underline, TrailingNode,
];
