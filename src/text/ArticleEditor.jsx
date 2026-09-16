import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, FontFamily } from '@tiptap/extension-text-style';
import { ARTICLE_FONTS, safeArticleLink } from './domain/article.js';
import { ArticleArtwork } from './ArticleView.jsx';
import { Bold, Italic, Underline, Quote, List, ListOrdered, Link, Undo, Redo } from '../public/InscapeIcons.jsx';
const formattingIcons = { Bold, Italic, Underline, Quote, Bullets: List, Numbered: ListOrdered, Link, Undo, Redo };

function ArtworkEditor({ node, updateAttributes, deleteNode }) {
  return <NodeViewWrapper contentEditable={false} className="text-artwork-editor">
    <ArticleArtwork attrs={node.attrs} />
    <label>Caption<input value={node.attrs.caption} maxLength={2000} onChange={e => updateAttributes({ caption: e.target.value })} /></label>
    <label>Alternative text<input value={node.attrs.alt} maxLength={1000} onChange={e => updateAttributes({ alt: e.target.value })} /></label>
    <button type="button" onClick={deleteNode}>Remove artwork</button>
  </NodeViewWrapper>;
}
const Artwork = Node.create({ name: 'artwork', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({ asset: { default: null }, alt: { default: '' }, caption: { default: '' } }),
  parseHTML: () => [], renderHTML: () => ['figure', { 'data-inscape-artwork': '' }],
  addNodeView: () => ReactNodeViewRenderer(ArtworkEditor),
});
export default function ArticleEditor({ article, onChange, onEditor, disabled }) {
  const latest = useRef({ article, onChange }); latest.current = { article, onChange };
  const [, rerender] = useState(0), [link, setLink] = useState(null), [linkError, setLinkError] = useState('');
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false,
      link: { openOnClick: false, autolink: false, linkOnPaste: false, protocols: ['https', 'mailto'] } }), TextStyle, FontFamily, Artwork],
    content: article.content, editable: !disabled,
    editorProps: { attributes: { class: 'text-document text-editor-content', 'aria-label': 'Article text', role: 'textbox', 'aria-multiline': 'true' },
      handlePaste: (_view, event) => {
        // Plain-text paste keeps unknown HTML/styles from silently becoming saved data.
        const text = event.clipboardData?.getData('text/plain'); if (text === undefined) return false;
        event.preventDefault();
        editor?.commands.insertContent(text.split(/\r?\n/u).map(line => ({ type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}) })));
        return true;
      } },
    onUpdate: ({ editor: current }) => latest.current.onChange({ ...latest.current.article, content: current.getJSON() }),
    onSelectionUpdate: () => rerender(n => n + 1), onTransaction: () => rerender(n => n + 1),
  });
  useEffect(() => { onEditor(editor); return () => onEditor(null); }, [editor, onEditor]);
  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);
  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(article.content)) editor.commands.setContent(article.content, { emitUpdate: false });
  }, [editor, article.content]);
  if (!editor) return <p role="status">Opening editor…</p>;
  const command = (name, action, active = false) => {
    const Icon = formattingIcons[name];
    return <button type="button" key={name} aria-label={name} title={name} aria-pressed={['Undo', 'Redo'].includes(name) ? undefined : active}
      disabled={disabled || name === 'Undo' && !editor.can().undo() || name === 'Redo' && !editor.can().redo()}
      onMouseDown={e => e.preventDefault()} onClick={action}><Icon /></button>;
  };
  return <>
    <div className="text-toolbar" role="toolbar" aria-label="Text formatting">
      <select aria-label="Paragraph style" disabled={disabled} value={editor.isActive('heading') ? editor.getAttributes('heading').level : 'paragraph'}
        onChange={e => e.target.value === 'paragraph' ? editor.chain().focus().setParagraph().run() : editor.chain().focus().setHeading({ level: Number(e.target.value) }).run()}>
        <option value="paragraph">Paragraph</option>{[1, 2, 3].map(n => <option key={n} value={n}>Heading {n}</option>)}
      </select>
      <select aria-label="Selected text font" disabled={disabled} value={editor.getAttributes('textStyle').fontFamily || ''}
        onChange={e => e.target.value ? editor.chain().focus().setFontFamily(e.target.value).run() : editor.chain().focus().unsetFontFamily().run()}>
        <option value="">Document font</option>{ARTICLE_FONTS.map(f => <option key={f.id} value={f.family}>{f.label}</option>)}
      </select>
      {command('Bold', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
      {command('Italic', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
      {command('Underline', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
      {command('Quote', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
      {command('Bullets', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
      {command('Numbered', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
      {command('Link', () => { setLink(editor.getAttributes('link').href || ''); setLinkError(''); }, editor.isActive('link'))}
      {command('Undo', () => editor.chain().focus().undo().run())}{command('Redo', () => editor.chain().focus().redo().run())}
    </div>
    {link !== null && <form className="text-inline-form" onSubmit={e => { e.preventDefault();
      if (link && !safeArticleLink(link)) { setLinkError('Use an HTTPS or mailto link.'); return; }
      if (link) editor.chain().focus().extendMarkRange('link').setLink({ href: link }).run(); else editor.chain().focus().unsetLink().run(); setLink(null);
    }}><label>Link URL<input autoFocus value={link} maxLength={2048} onChange={e => setLink(e.target.value)} /></label>
      <button type="submit">Apply link</button><button type="button" onClick={() => { setLink(null); editor.commands.focus(); }}>Cancel</button>{linkError && <p role="alert">{linkError}</p>}</form>}
    <div className="text-editor-page" style={{ fontFamily: ARTICLE_FONTS.find(f => f.id === article.font).family }}>
      <textarea rows={2} className="text-document-title" aria-label="Article title" placeholder="Untitled article" maxLength={160} disabled={disabled} value={article.title} onChange={e => onChange({ ...article, title: e.target.value.replace(/\n/gu, ' ') })} />
      <EditorContent editor={editor} />
    </div>
  </>;
}
