import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, FontFamily } from '@tiptap/extension-text-style';
import { ARTICLE_FONTS, safeArticleLink, textAppearance, textContentStyle } from './domain/article.js';
import { ArticleArtwork } from './ArticleView.jsx';
import { ArticleAlignment } from './articleAlignment.js';
import { Bold, Italic, Underline, Quote, List, ListOrdered, Link, Undo, Redo, AlignLeft, AlignCenter, AlignRight } from '../public/InscapeIcons.jsx';
const formattingIcons = { Bold, Italic, Underline, Quote, Bullets: List, Numbered: ListOrdered, Link, Undo, Redo, 'Align left': AlignLeft, 'Align center': AlignCenter, 'Align right': AlignRight };

function ArtworkEditor({ node }) {
  return <NodeViewWrapper contentEditable={false} className="text-artwork-editor">
    <ArticleArtwork attrs={node.attrs} />
  </NodeViewWrapper>;
}
const Artwork = Node.create({ name: 'artwork', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({ asset: { default: null }, alt: { default: '' }, caption: { default: '' } }),
  parseHTML: () => [], renderHTML: () => ['figure', { 'data-inscape-artwork': '' }],
  addNodeView: () => ReactNodeViewRenderer(ArtworkEditor),
});
const PageBreak = Node.create({ name: 'pageBreak', group: 'block', atom: true,
  parseHTML: () => [{ tag: 'div[data-text-page-break]' }],
  renderHTML: () => ['div', { 'data-text-page-break': '', class: 'text-page-break' }],
});
export default function ArticleEditor({ article, onChange, onEditor, disabled, controlsHost }) {
  const latest = useRef({ article, onChange }); latest.current = { article, onChange };
  const [, rerender] = useState(0), [link, setLink] = useState(null), [linkError, setLinkError] = useState('');
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false,
      link: { openOnClick: false, autolink: false, linkOnPaste: false, protocols: ['https', 'mailto'] } }), TextStyle, FontFamily, Artwork, ArticleAlignment, PageBreak],
    content: article.content, editable: !disabled,
    editorProps: { attributes: { class: 'text-document text-editor-content', 'aria-label': 'Article text', role: 'textbox', 'aria-multiline': 'true',
      spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' },
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
  useEffect(() => { onEditor?.(editor?.isDestroyed ? null : editor); return () => onEditor?.(null); }, [editor, onEditor]);
  useEffect(() => { if (editor && !editor.isDestroyed) editor.setEditable(!disabled); }, [editor, disabled]);
  useEffect(() => {
    if (editor && !editor.isDestroyed && JSON.stringify(editor.getJSON()) !== JSON.stringify(article.content)) editor.commands.setContent(article.content, { emitUpdate: false });
  }, [editor, article.content]);
  if (!editor || editor.isDestroyed) return <p role="status">Opening editor…</p>;
  const alignmentActive = value => editor.isActive({ textAlign: value }) || value === 'left' && editor.isActive({ textAlign: null });
  const justification = ['justify-left', 'justify-center', 'justify-right', 'justify-all'].find(alignmentActive) || '';
  const command = (name, action, active = false) => {
    const Icon = formattingIcons[name];
    return <button type="button" key={name} aria-label={name} title={name} aria-pressed={['Undo', 'Redo'].includes(name) ? undefined : active}
      disabled={disabled || name === 'Undo' && !editor.can().undo() || name === 'Redo' && !editor.can().redo()}
      onMouseDown={e => e.preventDefault()} onClick={action}><Icon /></button>;
  };
  const appearance = textAppearance(article);
  return <>
    {controlsHost && createPortal(<>
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
      {['left', 'center', 'right'].map(value => command(`Align ${value}`, () => editor.chain().focus().setArticleAlignment(value).run(), alignmentActive(value)))}
      <select aria-label="Paragraph justification" title="Paragraph justification" disabled={disabled} value={justification}
        onChange={e => editor.chain().focus().setArticleAlignment(e.target.value).run()}>
        <option value="" disabled>Justify</option>
        <option value="justify-left">Justify Left</option><option value="justify-center">Justify Center</option>
        <option value="justify-right">Justify Right</option><option value="justify-all">Justify All</option>
      </select>
      <button type="button" aria-label="Insert page break" title="Insert page break" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().insertContent({ type: 'pageBreak' }).run()}>↦</button>
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
    {editor.isActive('artwork') && <section className="text-inline-form" aria-label="Selected artwork">
      <label>Caption<input value={editor.getAttributes('artwork').caption} maxLength={2000} disabled={disabled} onChange={e => editor.commands.updateAttributes('artwork', { caption: e.target.value })} /></label>
      <label>Alternative text<input value={editor.getAttributes('artwork').alt} maxLength={1000} disabled={disabled} onChange={e => editor.commands.updateAttributes('artwork', { alt: e.target.value })} /></label>
      <button type="button" disabled={disabled} onClick={() => editor.chain().focus().deleteSelection().run()}>Remove artwork</button>
    </section>}
    </>, controlsHost)}
    <div className={`text-editor-page${appearance.compact ? ' text-document--compact' : ''}`} style={{ ...textContentStyle(article), fontFamily: ARTICLE_FONTS.find(f => f.id === article.font).family, fontSize: appearance.fontSize, color: article.appearance ? appearance.color : 'inherit', zoom: appearance.scale }}>
      {article.title && <h1 className="text-document-title" style={{ fontSize: appearance.titleFontSize ?? 28 }}>{article.title}</h1>}
      <EditorContent editor={editor} />
    </div>
  </>;
}
