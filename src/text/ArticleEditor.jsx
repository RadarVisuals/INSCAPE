import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { Node } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import StarterKit from '@tiptap/starter-kit';
import { FontFamily, Color } from '@tiptap/extension-text-style';
import { ARTICLE_FONTS, ARTICLE_FONT_SIZE, ARTICLE_TRACKING, ARTICLE_BLOCK_SPACING, ARTICLE_LINE_HEIGHT, safeArticleLink, textAppearance, textContentStyle, textTitleStyle } from './domain/article.js';
import { ArticleArtwork } from './ArticleView.jsx';
import { ArticleAlignment } from './articleAlignment.js';
import { ArticleSpacing, articleLineToSeparate, selectedBlockSpacing } from './articleSpacing.js';
import { ArticleTextStyle, ArticleTypography, selectedTypography } from './articleTypography.js';
import TextTypographyInput from './TextTypographyInput.jsx';
import ArticleOutline from './ArticleOutline.jsx';
import ArticleSearch from './ArticleSearch.jsx';
import ArticleFocusWriting from './ArticleFocusWriting.jsx';
import { ArticleSearchExtension, setArticleSearch } from './articleSearch.js';
import { insertArticleArtwork, moveArticleArtwork } from './articleArtworkEditing.js';
import { Bold, Italic, Underline, Quote, List, ListOrdered, Link, Undo, Redo, AlignLeft, AlignCenter, AlignRight, X } from '../public/InscapeIcons.jsx';
const formattingIcons = { Bold, Italic, Underline, Quote, Bullets: List, Numbered: ListOrdered, Link, Undo, Redo, 'Align left': AlignLeft, 'Align center': AlignCenter, 'Align right': AlignRight };

function ArtworkEditor({ node }) {
  return <NodeViewWrapper contentEditable={false} data-drag-handle="" className="text-artwork-editor">
    <ArticleArtwork attrs={node.attrs} />
  </NodeViewWrapper>;
}
const Artwork = Node.create({ name: 'artwork', group: 'block', atom: true, draggable: true,
  addCommands: () => ({ insertArticleArtwork }),
  addAttributes: () => ({ asset: { default: null }, alt: { default: '' }, caption: { default: '' } }),
  parseHTML: () => [], renderHTML: () => ['figure', { 'data-inscape-artwork': '' }],
  addNodeView: () => ReactNodeViewRenderer(ArtworkEditor),
});
const PageBreak = Node.create({ name: 'pageBreak', group: 'block', atom: true,
  parseHTML: () => [{ tag: 'div[data-text-page-break]' }],
  renderHTML: () => ['div', { 'data-text-page-break': '', class: 'text-page-break' }],
});
export default function ArticleEditor({ article, onChange, onEditor, onFindRequest, saveError, disabled, controlsHost }) {
  const latest = useRef({ article, onChange }); latest.current = { article, onChange };
  const searchHost = useRef(controlsHost); searchHost.current = controlsHost;
  const findRequest = useRef(onFindRequest); findRequest.current = onFindRequest;
  const pendingFind = useRef(false);
  const [searchFocusRequest, requestSearchFocus] = useState(0);
  const [focusWriting, setFocusWriting] = useState(false), focusTrigger = useRef(null);
  const focusWritingRef = useRef(focusWriting); focusWritingRef.current = focusWriting;
  const titleField = useRef(null), [editingTitle, setEditingTitle] = useState(false);
  useLayoutEffect(() => { if (editingTitle && !disabled) titleField.current?.focus(); }, [editingTitle]);
  useEffect(() => { if (disabled) setEditingTitle(false); }, [disabled]);
  const [, rerender] = useState(0), [link, setLink] = useState(null), [linkError, setLinkError] = useState('');
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false,
      link: { openOnClick: false, autolink: false, linkOnPaste: false, protocols: ['https', 'mailto'] } }), ArticleTextStyle, FontFamily, Color, Artwork, ArticleAlignment, ArticleSpacing, ArticleTypography, PageBreak, ArticleSearchExtension],
    content: article.content, editable: !disabled,
    editorProps: { attributes: { class: 'text-document text-document-body text-editor-content', 'aria-label': 'Article text', role: 'textbox', 'aria-multiline': 'true',
      spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Escape' && !event.isComposing && focusWritingRef.current) {
          event.preventDefault(); setFocusWriting(false); return true;
        }
        if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f' && editor?.isEditable && (searchHost.current || findRequest.current)) {
          event.preventDefault();
          if (focusWritingRef.current) { pendingFind.current = true; setFocusWriting(false); return true; }
          if (!searchHost.current) { pendingFind.current = true; findRequest.current(); return true; }
          searchHost.current.dispatchEvent(new CustomEvent('inscape:text-find', { bubbles: true }));
          setArticleSearch(editor, { open: true }); requestSearchFocus(value => value + 1);
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        // Plain-text paste keeps unknown HTML/styles from silently becoming saved data.
        const text = event.clipboardData?.getData('text/plain'); if (text === undefined) return false;
        event.preventDefault();
        // Image-only/empty clipboard content must never delete selected writing.
        if (!text) return true;
        editor?.chain().command(({ tr }) => { closeHistory(tr); return true; })
          .insertContent(text.split(/\r\n?|\n/u).map(line => ({ type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}) }))).run();
        return true;
      } },
    onUpdate: ({ editor: current }) => latest.current.onChange({ ...latest.current.article, content: current.getJSON() }),
    onSelectionUpdate: () => rerender(n => n + 1), onTransaction: () => rerender(n => n + 1),
  });
  useEffect(() => { onEditor?.(editor?.isDestroyed ? null : editor); return () => onEditor?.(null); }, [editor, onEditor]);
  // Read/Write and suspension change interaction, not authored content. Tiptap's
  // default update event would otherwise save (and clear recovery) on reopening.
  useEffect(() => { if (editor && !editor.isDestroyed) editor.setEditable(!disabled, false); }, [editor, disabled]);
  useEffect(() => {
    if (editor && !editor.isDestroyed && (disabled || !controlsHost)) setArticleSearch(editor, { close: true });
    if (disabled || !controlsHost) setFocusWriting(false);
  }, [editor, disabled, controlsHost]);
  useEffect(() => {
    if (disabled) pendingFind.current = false;
    if (editor && !editor.isDestroyed && controlsHost && !disabled && !focusWriting && pendingFind.current) {
      pendingFind.current = false;
      controlsHost.dispatchEvent(new CustomEvent('inscape:text-find', { bubbles: true }));
      setArticleSearch(editor, { open: true }); requestSearchFocus(value => value + 1);
    }
  }, [editor, disabled, controlsHost, focusWriting]);
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
      <button ref={focusTrigger} type="button" disabled={disabled} onMouseDown={event => event.preventDefault()}
        onClick={() => { setArticleSearch(editor, { close: true }); setFocusWriting(true); }}>Focus writing</button>
      {!article.title && <button type="button" disabled={disabled} onClick={() => setEditingTitle(true)}>Add title</button>}
      <div className="text-toolbar-font">
      <select aria-label="Selected text font" disabled={disabled} value={editor.getAttributes('textStyle').fontFamily || ''}
        onChange={e => e.target.value ? editor.chain().focus().setFontFamily(e.target.value).run() : editor.chain().focus().unsetFontFamily().run()}>
        <option value="">Document font</option>{ARTICLE_FONTS.map(f => <option key={f.id} value={f.family}>{f.label}</option>)}
      </select>
      <div className="text-selection-size" role="group" aria-label="Selected text typography">
        <TextTypographyInput key={`size:${editor.state.selection.from}:${editor.state.selection.to}`} label="" accessibleLabel="Selected text size"
          {...selectedTypography(editor, 'fontSize')} limits={ARTICLE_FONT_SIZE} disabled={disabled}
          placeholder={String(appearance.fontSize)}
          onChange={value => editor.commands.setArticleTypography('fontSize', value)} onReturn={() => editor.commands.focus()}
          resetLabel="Use inherited text size" />
      </div>
      </div>
      <div className="text-toolbar-icons">
      {command('Bold', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
      {command('Italic', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
      {command('Underline', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
      {command('Quote', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
      {command('Bullets', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
      {command('Numbered', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
      {['left', 'center', 'right'].map(value => command(`Align ${value}`, () => editor.chain().focus().setArticleAlignment(value).run(), alignmentActive(value)))}
      {command('Link', () => { setLink(editor.getAttributes('link').href || ''); setLinkError(''); }, editor.isActive('link'))}
      {command('Undo', () => editor.chain().focus().undo().run())}{command('Redo', () => editor.chain().focus().redo().run())}
      </div>
      <div className="text-toolbar-row text-block-row">
        <select aria-label="Paragraph style" disabled={disabled} value={editor.isActive('heading') ? editor.getAttributes('heading').level : 'paragraph'}
          onChange={e => e.target.value === 'paragraph' ? editor.chain().focus().setParagraph().run() : editor.chain().focus().setHeading({ level: Number(e.target.value) }).run()}>
          <option value="paragraph">Paragraph</option>{[1, 2, 3].map(n => <option key={n} value={n}>Heading {n}</option>)}
        </select>
        <div className="text-selection-colour">
          <label>Colour<input aria-label="Selected text colour" type="color" disabled={disabled}
            value={editor.getAttributes('textStyle').color || appearance.color}
            onChange={event => editor.chain().focus().setColor(event.target.value).run()} /></label>
          <button type="button" aria-label="Use document text colour" title="Use document text colour" disabled={disabled || !editor.getAttributes('textStyle').color}
            onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().unsetColor().run()}><X /></button>
        </div>
      </div>
      <ArticleOutline editor={editor} disabled={disabled} />
      <ArticleSearch editor={editor} article={article} disabled={disabled} focusRequest={searchFocusRequest} />
      <details className="text-inspector-advanced"><summary>Spacing &amp; alignment</summary>
      <TextTypographyInput key={`lineHeight:${editor.state.selection.from}:${editor.state.selection.to}`} label="Line spacing (×)" accessibleLabel="Paragraph line spacing"
        {...selectedBlockSpacing(editor, 'lineHeight')} limits={ARTICLE_LINE_HEIGHT}
        disabled={disabled || !selectedBlockSpacing(editor, 'lineHeight').available}
        onChange={value => editor.commands.setArticleSpacing('lineHeight', value)} onReturn={() => editor.commands.focus()}
        resetLabel="Use inherited paragraph line spacing" />
      <TextTypographyInput key={`tracking:${editor.state.selection.from}:${editor.state.selection.to}`} label="Letter spacing (em)" accessibleLabel="Selected text tracking"
        {...selectedTypography(editor, 'letterSpacing')} limits={ARTICLE_TRACKING} disabled={disabled}
        onChange={value => editor.commands.setArticleTypography('letterSpacing', value)} onReturn={() => editor.commands.focus()}
        resetLabel="Use inherited text tracking" />
      <div className="text-toolbar-row">
      <select aria-label="Paragraph justification" title="Paragraph justification" disabled={disabled} value={justification}
        onChange={e => editor.chain().focus().setArticleAlignment(e.target.value).run()}>
        <option value="" disabled>Justify</option>
        <option value="justify-left">Justify Left</option><option value="justify-center">Justify Center</option>
        <option value="justify-right">Justify Right</option><option value="justify-all">Justify All</option>
      </select>
      </div>
      <div role="group" aria-label="Paragraph spacing">
        {articleLineToSeparate(editor.state.selection) && <div className="text-paragraph-line">
          <p>This line shares a paragraph.</p>
          <button type="button" disabled={disabled} onMouseDown={event => event.preventDefault()}
            onClick={() => editor.chain().focus().separateArticleLine().run()}>Separate this line</button>
        </div>}
        {['Before', 'After'].map(side => {
          const name = `space${side}`, spacing = selectedBlockSpacing(editor, name);
          return <TextTypographyInput key={`${name}:${editor.state.selection.from}:${editor.state.selection.to}`}
            label={`Paragraph ${side.toLowerCase()} (px)`} accessibleLabel={`Paragraph space ${side.toLowerCase()}`}
            {...spacing} limits={ARTICLE_BLOCK_SPACING} disabled={disabled || !spacing.available} placeholder="Automatic"
            onChange={value => editor.commands.setArticleSpacing(name, value)} onReturn={() => editor.commands.focus()}
            resetLabel={`Use automatic paragraph space ${side.toLowerCase()}`} />;
        })}
      </div>
      </details>
      <button className="text-insert-break" type="button" aria-label="Insert page break" title="Insert page break" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().insertContent({ type: 'pageBreak' }).run()}>Insert page break</button>
    </div>
    {link !== null && <form className="text-inline-form" onSubmit={e => { e.preventDefault();
      if (link && !safeArticleLink(link)) { setLinkError('Use an HTTPS or mailto link.'); return; }
      if (link) editor.chain().focus().extendMarkRange('link').setLink({ href: link }).run(); else editor.chain().focus().unsetLink().run(); setLink(null);
    }}><label>Link URL<input autoFocus value={link} maxLength={2048} onChange={e => setLink(e.target.value)} /></label>
      <button type="submit">Apply link</button><button type="button" onClick={() => { setLink(null); editor.commands.focus(); }}>Cancel</button>{linkError && <p role="alert">{linkError}</p>}</form>}
    {editor.isActive('artwork') && <section className="text-inline-form" aria-label="Selected artwork">
      {[-1, 1].map(direction => <button type="button" key={direction}
        disabled={disabled || !editor.can().command(moveArticleArtwork(direction))}
        onMouseDown={event => event.preventDefault()}
        onClick={() => { editor.commands.command(moveArticleArtwork(direction)); editor.commands.focus(); }}>
        Move artwork {direction < 0 ? 'up' : 'down'}
      </button>)}
      <label>Caption<input value={editor.getAttributes('artwork').caption} maxLength={2000} disabled={disabled} onChange={e => editor.commands.updateAttributes('artwork', { caption: e.target.value })} /></label>
      <label>Alternative text<input value={editor.getAttributes('artwork').alt} maxLength={1000} disabled={disabled} onChange={e => editor.commands.updateAttributes('artwork', { alt: e.target.value })} /></label>
      <button type="button" disabled={disabled} onClick={() => editor.chain().focus().deleteSelection().run()}>Remove artwork</button>
    </section>}
    </>, controlsHost)}
    <ArticleFocusWriting active={focusWriting} onClose={() => setFocusWriting(false)} editor={editor} returnFocus={focusTrigger}
      title={article.title} background={article.appearance?.background} saveError={saveError}>
    <div className={`text-editor-page${appearance.compact ? ' text-document--compact' : ''}`} style={textContentStyle(article)}>
      {(article.title || editingTitle) && <textarea ref={titleField} className="text-document-title" aria-label="Article title" placeholder="Title (optional)" rows={1}
        spellCheck={false} autoCorrect="off" autoCapitalize="off" maxLength={160} disabled={disabled}
        style={textTitleStyle(article)} value={article.title}
        onFocus={() => setEditingTitle(true)} onBlur={() => setEditingTitle(false)}
        onChange={event => latest.current.onChange({ ...latest.current.article, title: event.target.value.replace(/[\r\n]+/g, ' ') })}
        onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); editor.commands.focus('start'); } }} />}
      <div className={`text-editor-body${!disabled && editor.isEmpty ? ' text-editor-body--empty' : ''}`}>
        <EditorContent editor={editor} />
        {!disabled && editor.isEmpty && <span className="text-editor-placeholder" aria-hidden="true">Start writing…</span>}
      </div>
    </div>
    </ArticleFocusWriting>
  </>;
}
