import { COLOUR_PREVIEW } from './articleColourGesture.js';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { OwnerSystemWorkflowSelectMenu } from '../public/ownerSystemWorkflow/OwnerSystemWorkflowWorkspaceControls.jsx';
import { EditorContent, useEditor, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { Node } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { Fragment, Slice } from '@tiptap/pm/model';
import { articleExtensions } from './articleExtensions.js';
import { FontFamily } from '@tiptap/extension-text-style/font-family';
import { Color } from '@tiptap/extension-text-style/color';
import { ARTICLE_FONTS, ARTICLE_FONT_SIZE, ARTICLE_TRACKING, ARTICLE_BLOCK_SPACING, ARTICLE_LINE_HEIGHT, safeArticleLink, textAppearance, textContentStyle, textTitleStyle } from './domain/article.js';
import { ArticleArtwork } from './ArticleView.jsx';
import { ArticleAlignment } from './articleAlignment.js';
import { ArticleSpacing, articleLineToSeparate, selectedBlockSpacing, captureArticleSpacing } from './articleSpacing.js';
import { ArticleTextStyle, ArticleTypography, activeArticleFontPreview, articleContentWithFont, previewArticleFont, selectedFont, selectedTypography, selectedCharacterStyle, captureArticleTypography } from './articleTypography.js';
import TextTypographyInput, { TitleTypographyInput } from './TextTypographyInput.jsx';
import EditorToolbarPopover from '../public/ownerSystemWorkflow/EditorToolbarPopover.jsx';
import ArticleOutline from './ArticleOutline.jsx';
import ArticleSearch from './ArticleSearch.jsx';
import ArticleFocusWriting from './ArticleFocusWriting.jsx';
import { ArticleSearchExtension, setArticleSearch } from './articleSearch.js';
import { ArticleFlowFocus, createArticleFlowEditor } from './articleFlowEditor.js';
import { insertArticleArtwork, moveArticleArtwork } from './articleArtworkEditing.js';
import { Bold, Italic, MoveHorizontal, Underline, Strikethrough, Quote, List, ListOrdered, Link, Undo2 as Undo, Redo2 as Redo, AlignLeft, AlignCenter, AlignRight, X } from 'lucide-react';
const formattingIcons = { Bold, Italic, Underline, Strikethrough, Quote, Bullets: List, Numbered: ListOrdered, Link, Undo, Redo, 'Align left': AlignLeft, 'Align center': AlignCenter, 'Align right': AlignRight };

export function ContinuationEditor({ controller, article, range, index }) {
  const host = useRef(null), mounted = useRef(null), currentRange = useRef(range);
  currentRange.current = range;
  useLayoutEffect(() => {
    // Range updates below keep the existing editor view and its selection alive.
    const item = controller.bridge.create(range.id, host.current, currentRange.current.from ?? 0, currentRange.current.to ?? 0);
    item.view.setProps({ attributes: { ...controller.editor.view.props.attributes, 'aria-label': `Article text in frame ${index + 1}` } });
    mounted.current = item;
    return () => { mounted.current = null; item.dispose(); };
  }, [controller, range.id, index]);
  useLayoutEffect(() => { controller.bridge.update(range.id, range.from ?? 0, range.to ?? 0); }, [controller, range.id, range.from, range.to]);
  return <div className={`text-editor-page${article.appearance?.compact ? ' text-document--compact' : ''}`} style={textContentStyle(article)}>
    <div className="text-editor-body"><div ref={host} /></div>
  </div>;
}

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
export default function ArticleEditor({ article, onChange, onEditor, onFindRequest, saveError, saveStatus, focusClassName, disabled, controlsHost, quickToolsHost, quickColor, onFitFontPreview, flowRange, onFlowEditor, sharedColour = false, containerOwned = false, titlePlaceholder = true }) {
  const [flowBridge] = useState(createArticleFlowEditor);
  const latest = useRef({ article, onChange }); latest.current = { article, onChange };
  const searchHost = useRef(controlsHost); searchHost.current = controlsHost;
  const findRequest = useRef(onFindRequest); findRequest.current = onFindRequest;
  const pendingFind = useRef(false);
  const fontRequest = useRef(0);
  const [focusedPart, setFocusedPart] = useState(null);
  const [searchFocusRequest, requestSearchFocus] = useState(0);
  const [focusWriting, setFocusWriting] = useState(false), focusTrigger = useRef(null);
  flowBridge.configure(Boolean(flowRange), focusWriting);
  const focusWritingRef = useRef(focusWriting); focusWritingRef.current = focusWriting;
  const [, rerender] = useState(0), [link, setLink] = useState(null), [linkError, setLinkError] = useState('');
  const editor = useEditor({
    extensions: [...articleExtensions, ArticleTextStyle, FontFamily, Color, Artwork, ArticleAlignment, ArticleSpacing, ArticleTypography, PageBreak, ArticleSearchExtension, ArticleFlowFocus(flowBridge)],
    content: article.content, editable: !disabled,
    editorProps: { ...flowBridge.props('first'), attributes: { class: 'text-document text-document-body text-editor-content', 'aria-label': 'Article text', role: 'textbox', 'aria-multiline': 'true',
      spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' },
      handleKeyDown: (_view, event) => {
        if (_view === editor?.view && flowBridge.props('first').handleKeyDown(_view, event)) return true;
        if (event.key === 'Escape' && !event.isComposing && focusWritingRef.current) {
          event.preventDefault(); setFocusWriting(false); return true;
        }
        if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f' && editor?.isEditable && (searchHost.current || findRequest.current)) {
          event.preventDefault();
          if (focusWritingRef.current) { pendingFind.current = true; setFocusWriting(false); return true; }
          if (!searchHost.current) { pendingFind.current = true; findRequest.current(); return true; }
          setArticleSearch(editor, { open: true }); requestSearchFocus(value => value + 1);
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        // Plain-text paste keeps unknown HTML/styles from silently becoming saved data.
        const text = event.clipboardData?.getData('text/plain'); if (text === undefined) return false;
        event.preventDefault();
        // Image-only/empty clipboard content must never delete selected writing.
        if (!text) return true;
        const { state } = view, { $from } = state.selection;
        const tr = closeHistory(state.tr);
        const lines = text.split(/\r\n?|\n/u);
        const insideBlock = $from.parent.isTextblock;
        if (lines.length === 1 && insideBlock) tr.insertText(text);
        else {
          // Select All starts at the document root. The first selected text block
          // supplies the same formatting that typing at its start would use.
          const block = insideBlock ? $from.parent : $from.nodeAfter;
          const marks = state.storedMarks || (insideBlock ? $from.marks() : block?.firstChild?.marks) || [];
          const paragraphs = lines.map((line, index) => {
            const type = index === 0 && block?.isTextblock ? block.type : state.schema.nodes.paragraph;
            return type.create(block?.attrs, line ? state.schema.text(line, marks) : null);
          });
          const open = insideBlock ? 1 : 0;
          tr.replaceSelection(new Slice(Fragment.fromArray(paragraphs), open, open));
        }
        view.dispatch(tr.scrollIntoView());
        return true;
      } },
    onUpdate: ({ editor: current, transaction }) => { if (!transaction.getMeta(COLOUR_PREVIEW)) latest.current.onChange({ ...latest.current.article, content: current.getJSON() }); },
    onSelectionUpdate: () => rerender(n => n + 1), onTransaction: () => rerender(n => n + 1),
  });
  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const disconnect = flowBridge.connect(editor), unregister = flowBridge.register('first', editor.view, 0, editor.state.doc.content.size);
    onFlowEditor?.({ editor, bridge: flowBridge });
    return () => { onFlowEditor?.(null); unregister(); disconnect(); };
  }, [editor, flowBridge, onFlowEditor]);
  useLayoutEffect(() => () => { fontRequest.current += 1; }, [editor, quickToolsHost, disabled, focusWriting, focusedPart]);
  const hasFlowRange = Boolean(flowRange);
  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return;
    flowBridge.update('first', flowRange?.from || 0, flowRange?.to ?? editor.state.doc.content.size); flowBridge.refresh();
  }, [editor, flowBridge, flowRange?.from, flowRange?.to, hasFlowRange, focusWriting]);
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
      setArticleSearch(editor, { open: true }); requestSearchFocus(value => value + 1);
    }
  }, [editor, disabled, controlsHost, focusWriting]);
  useEffect(() => {
    if (editor && !editor.isDestroyed && !editor.state.doc.eq(editor.schema.nodeFromJSON(article.content))) editor.commands.setContent(article.content, { emitUpdate: false });
  }, [editor, article.content]);
  const previewFont = useCallback(family => previewArticleFont(editor, family), [editor]);
  const previewFamily = activeArticleFontPreview(editor);
  useEffect(() => {
    if (!previewFamily || !onFitFontPreview) return;
    let cancelled = false;
    const fit = () => {
      if (cancelled || activeArticleFontPreview(editor) !== previewFamily) return;
      onFitFontPreview({ ...latest.current.article, content: articleContentWithFont(editor, previewFamily) });
    };
    const fonts = editor.view.dom.ownerDocument.fonts;
    // Measure outside React's commit, once the candidate's glyphs are available.
    Promise.resolve(fonts?.load(`16px "${previewFamily}"`)).then(fit, fit);
    return () => { cancelled = true; onFitFontPreview(null); };
  }, [editor, previewFamily, onFitFontPreview]);
  if (!editor || editor.isDestroyed) return <p role="status">Opening editor…</p>;
  const alignmentActive = value => editor.isActive({ textAlign: value }) || value === 'left' && editor.isActive({ textAlign: null });
  const justification = ['justify-left', 'justify-center', 'justify-right', 'justify-all'].find(alignmentActive) || '';
  const command = (name, action, active = false, className = 'workflow-tactile-control workflow-tactile-control--quiet') => {
    const Icon = formattingIcons[name];
    return <button className={className} type="button" key={name} aria-label={name} title={name} aria-pressed={['Undo', 'Redo'].includes(name) ? undefined : active}
      disabled={disabled || name === 'Undo' && !editor.can().undo() || name === 'Redo' && !editor.can().redo()}
      onMouseDown={e => e.preventDefault()} onClick={action}><Icon /></button>;
  };
  const appearance = textAppearance(article);
  const font = selectedFont(editor, article);
  const characterStyle = selectedCharacterStyle(editor);
  function chooseFont(family) {
    const request = ++fontRequest.current;
    const apply = () => editor.chain().focus().setFontFamily(family).run();
    const fonts = editor.view.dom.ownerDocument.fonts;
    const face = `16px "${family}"`;
    if (!quickToolsHost || !fonts || fonts.check(face)) return apply();

    // Bento fits the frame in the same edit. Measure the chosen face on its first use.
    const { doc, selection, storedMarks } = editor.state;
    const applyIfCurrent = () => {
      if (request !== fontRequest.current || editor.isDestroyed || !editor.isEditable) return;
      const current = editor.state;
      if (doc === current.doc && selection.eq(current.selection) && storedMarks === current.storedMarks) apply();
    };
    fonts.load(face).then(applyIfCurrent, applyIfCurrent);
  }
  const fontMenu = compact => <OwnerSystemWorkflowSelectMenu flat compact aboveToolbar={compact} palette="editor" className={compact ? "editor-object-toolbar-button bento-text-font" : "workflow-tactile-control"} label={compact ? "Text font" : "Selected text font"} disabled={disabled} value={font.value}
    options={[...(!font.value ? [{ value: '', label: 'Mixed fonts', disabled: true }] : []), ...ARTICLE_FONTS.map(font => ({
      value: font.family, label: font.label, sampleFont: compact && editor.state.selection.empty ? font.family : undefined,
    }))]}
    onPreview={compact ? previewFont : undefined} onChange={chooseFont} />;
  const sizeField = compact => <TextTypographyInput key={`size:${editor.state.selection.from}:${editor.state.selection.to}`} label="Size" compact={compact} accessibleLabel={compact ? "Font size" : "Selected text size"}
    {...selectedTypography(editor, 'fontSize')} limits={ARTICLE_FONT_SIZE} disabled={disabled}
    placeholder={String(appearance.fontSize)}
    onStart={() => captureArticleTypography(editor)}
    onChange={value => editor.commands.setArticleTypography('fontSize', value)} onReturn={() => editor.commands.focus()}
    resetLabel="Use default text size" />;
  const trackingField = <TextTypographyInput key={`tracking:${editor.state.selection.from}:${editor.state.selection.to}`} label="Tracking" accessibleLabel="Selected text tracking"
    {...selectedTypography(editor, 'letterSpacing')} limits={ARTICLE_TRACKING} disabled={disabled}
    onStart={() => captureArticleTypography(editor)}
    onChange={value => editor.commands.setArticleTypography('letterSpacing', value)} onReturn={() => editor.commands.focus()}
    resetLabel="Use default letter spacing" />;
  const lineHeightField = <TextTypographyInput key={`lineHeight:${editor.state.selection.from}:${editor.state.selection.to}`} label="Line height" accessibleLabel="Paragraph line spacing"
    {...selectedBlockSpacing(editor, 'lineHeight')} limits={ARTICLE_LINE_HEIGHT}
    disabled={disabled || !selectedBlockSpacing(editor, 'lineHeight').available}
    onStart={() => captureArticleSpacing(editor, 'lineHeight')}
    onChange={value => editor.commands.setArticleSpacing('lineHeight', value)} onReturn={() => editor.commands.focus()}
    resetLabel="Use default paragraph line spacing" />;
  const emphasis = className => <>
    {command('Bold', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), className)}
    {command('Italic', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), className)}
  </>;
  const editingTitle = Boolean(article.title && (focusedPart === 'title' || (!focusedPart && editor.isEmpty)));
  return <>
    {quickToolsHost && !disabled && !focusWriting && createPortal(<>
      {editingTitle ? <TitleTypographyInput {...{ article, onChange, disabled }} compact /> : <>
        {fontMenu(true)}{sizeField(true)}{emphasis('editor-object-toolbar-button')}
      </>}
      {quickColor(editingTitle ? 'title' : 'body')}
      <EditorToolbarPopover label="Text spacing" trigger={<MoveHorizontal aria-hidden="true" />}>
        <strong>Spacing</strong><div className="bento-text-spacing">
          {editingTitle ? <TitleTypographyInput {...{ article, onChange, disabled }} tracking /> : <>{trackingField}{lineHeightField}</>}
        </div>
      </EditorToolbarPopover>
    </>, quickToolsHost)}
    {controlsHost && createPortal(<>
    <div className="text-toolbar" role="toolbar" aria-label="Text formatting">
      <span className="text-formatting-scope" title={editor.state.selection.empty ? 'Applies to what you type next.' : 'Applies only to the selected text.'}>{editor.state.selection.empty ? 'At the cursor' : 'Selected text'}</span>
      <section className="text-tool-group" aria-label="Character formatting">
      <div className="text-selection-font">
        <div className="text-format-field"><span>Font</span>
          {fontMenu(false)}
        </div>
        <button className="workflow-tactile-control workflow-tactile-control--quiet" type="button" aria-label={font.resetLabel} title={font.resetLabel}
          disabled={disabled || !font.hasOverride} onMouseDown={event => event.preventDefault()}
          onClick={() => { fontRequest.current += 1; editor.chain().focus().unsetFontFamily().run(); }}><X /></button>
      </div>
      <div className="text-format-field"><span>Style</span><OwnerSystemWorkflowSelectMenu flat compact palette="editor" className="workflow-tactile-control" label="Selected text style" disabled={disabled} value={characterStyle}
        options={[...(!characterStyle ? [{ value: '', label: 'Mixed styles', disabled: true }] : []), { value: 'regular', label: 'Regular' }, { value: 'bold', label: 'Bold' }, { value: 'italic', label: 'Italic' }, { value: 'bold-italic', label: 'Bold italic' }]}
        onChange={value => {
          const chain = editor.chain().focus();
          if (value.includes('bold')) chain.setBold(); else chain.unsetBold();
          if (value.includes('italic')) chain.setItalic(); else chain.unsetItalic();
          chain.run();
        }} /></div>
      <div className="text-selection-size" role="group" aria-label="Selected text typography">
        {sizeField(false)}
      </div>
      {trackingField}
      <div className="text-toolbar-icons text-character-marks">
      {emphasis()}
      {command('Underline', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
      {command('Strikethrough', () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'))}
      </div>
      </section>
      <section className="text-tool-group" aria-label="Paragraph formatting"><h3>Paragraph</h3>
      {lineHeightField}
      <div className="text-paragraph-alignment">
        <div className="text-toolbar-icons">{['left', 'center', 'right'].map(value => command(`Align ${value}`, () => editor.chain().focus().setArticleAlignment(value).run(), alignmentActive(value)))}</div>
        <OwnerSystemWorkflowSelectMenu flat compact palette="editor" className="workflow-tactile-control" label="Paragraph justification" disabled={disabled} value={justification}
          options={[{ value: '', label: 'Justify: off' }, { value: 'justify-left', label: 'Justify Left' }, { value: 'justify-center', label: 'Justify Center' }, { value: 'justify-right', label: 'Justify Right' }, { value: 'justify-all', label: 'Justify All' }]}
          onChange={value => editor.chain().focus().setArticleAlignment(value || 'left').run()} />
      </div>
      <div className="text-toolbar-row text-writing-shortcuts">
        <button className="workflow-tactile-control workflow-tactile-control--quiet" type="button" aria-label="Insert page break" title="Insert page break" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().insertContent({ type: 'pageBreak' }).run()}>Page break</button>
        <button className="workflow-tactile-control workflow-tactile-control--quiet" ref={focusTrigger} type="button" disabled={disabled} onMouseDown={event => event.preventDefault()}
          onClick={() => { setArticleSearch(editor, { close: true }); setFocusWriting(true); }}>Focus writing</button>
      </div>
      </section>
      <details className="text-inspector-section text-more-tools"><summary>More text tools</summary>
      <div className="text-toolbar-row text-block-row">
        <select aria-label="Paragraph style" disabled={disabled} value={editor.isActive('heading') ? editor.getAttributes('heading').level : 'paragraph'}
          onChange={e => e.target.value === 'paragraph' ? editor.chain().focus().setParagraph().run() : editor.chain().focus().setHeading({ level: Number(e.target.value) }).run()}>
          <option value="paragraph">Paragraph</option>{[1, 2, 3].map(n => <option key={n} value={n}>Heading {n}</option>)}
        </select>
        {!sharedColour && <div className="text-selection-colour">
          <label>Colour<input aria-label="Selected text colour" type="color" disabled={disabled}
            value={editor.getAttributes('textStyle').color || appearance.color}
            onChange={event => editor.chain().focus().setColor(event.target.value).run()} /></label>
          <button className="workflow-tactile-control" type="button" aria-label="Use document text colour" title="Use document text colour" disabled={disabled || !editor.getAttributes('textStyle').color}
            onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().unsetColor().run()}><X /></button>
        </div>}
      </div>
      <div className="text-toolbar-icons text-paragraph-marks">
        {command('Quote', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
        {command('Bullets', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
        {command('Numbered', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
      </div>
      <div role="group" aria-label="Paragraph spacing">
        {articleLineToSeparate(editor.state.selection) && <div className="text-paragraph-line">
          <p>This line shares a paragraph.</p>
          <button className="workflow-tactile-control" type="button" disabled={disabled} onMouseDown={event => event.preventDefault()}
            onClick={() => editor.chain().focus().separateArticleLine().run()}>Separate this line</button>
        </div>}
        {['Before', 'After'].map(side => {
          const name = `space${side}`, spacing = selectedBlockSpacing(editor, name);
          return <TextTypographyInput key={`${name}:${editor.state.selection.from}:${editor.state.selection.to}`}
            label={`Paragraph ${side.toLowerCase()} (px)`} accessibleLabel={`Paragraph space ${side.toLowerCase()}`}
            {...spacing} limits={ARTICLE_BLOCK_SPACING} disabled={disabled || !spacing.available} placeholder="Automatic"
            onStart={() => captureArticleSpacing(editor, name)}
            onChange={value => editor.commands.setArticleSpacing(name, value)} onReturn={() => editor.commands.focus()}
            resetLabel={`Use automatic paragraph space ${side.toLowerCase()}`} />;
        })}
      </div>
      <div className="text-toolbar-icons text-history-links">
        {command('Link', () => { setLink(editor.getAttributes('link').href || ''); setLinkError(''); }, editor.isActive('link'))}
        {command('Undo', () => editor.chain().focus().undo().run())}{command('Redo', () => editor.chain().focus().redo().run())}
      </div>
    {link !== null && <form className="text-inline-form" onSubmit={e => { e.preventDefault();
      if (link && !safeArticleLink(link)) { setLinkError('Use an HTTPS or mailto link.'); return; }
      if (link) editor.chain().focus().extendMarkRange('link').setLink({ href: link }).run(); else editor.chain().focus().unsetLink().run(); setLink(null);
    }}><label>Link URL<input autoFocus value={link} maxLength={2048} onChange={e => setLink(e.target.value)} /></label>
      <button className="workflow-tactile-control" type="submit">Apply link</button><button className="workflow-tactile-control" type="button" onClick={() => { setLink(null); editor.commands.focus(); }}>Cancel</button>{linkError && <p role="alert">{linkError}</p>}</form>}
      </details>
      <details className="text-inspector-section text-writing-tools"><summary>Find and replace / Outline</summary>
        <ArticleSearch editor={editor} article={article} disabled={disabled} focusRequest={searchFocusRequest} />
        <ArticleOutline editor={editor} disabled={disabled} />
      </details>
    </div>
    {editor.isActive('artwork') && <section className="text-inline-form" aria-label="Selected artwork">
      {[-1, 1].map(direction => <button className="workflow-tactile-control" type="button" key={direction}
        disabled={disabled || !editor.can().command(moveArticleArtwork(direction))}
        onMouseDown={event => event.preventDefault()}
        onClick={() => { editor.commands.command(moveArticleArtwork(direction)); editor.commands.focus(); }}>
        Move artwork {direction < 0 ? 'up' : 'down'}
      </button>)}
      <label>Caption<input value={editor.getAttributes('artwork').caption} maxLength={2000} disabled={disabled} onChange={e => editor.commands.updateAttributes('artwork', { caption: e.target.value })} /></label>
      <label>Alternative text<input value={editor.getAttributes('artwork').alt} maxLength={1000} disabled={disabled} onChange={e => editor.commands.updateAttributes('artwork', { alt: e.target.value })} /></label>
      <button className="workflow-tactile-control" type="button" disabled={disabled} onClick={() => editor.chain().focus().deleteSelection().run()}>Remove artwork</button>
    </section>}
    </>, controlsHost)}
    <ArticleFocusWriting active={focusWriting} onClose={() => setFocusWriting(false)} editor={editor} returnFocus={focusTrigger}
      title={article.title} background={article.appearance?.background} saveError={saveError} saveStatus={saveStatus} className={focusClassName}>
    <div className={`text-editor-page${appearance.compact ? ' text-document--compact' : ''}`} data-writing-direction={appearance.writingDirection} style={textContentStyle(article, { containerOwned: containerOwned && !focusWriting })}
      onFocusCapture={event => { if (quickToolsHost) setFocusedPart(event.target.matches('.text-document-title') ? 'title' : 'body'); }}
      data-title-only={(!titlePlaceholder && !focusWriting && Boolean(article.title) && editor.isEmpty) || undefined}>
      {(article.title || !disabled) && <textarea className="text-document-title" aria-label="Article title" placeholder="Title" rows={1}
        data-empty-optional-title={(!titlePlaceholder && !article.title) || undefined}
        spellCheck={false} autoCorrect="off" autoCapitalize="off" maxLength={160} disabled={disabled}
        style={textTitleStyle(article)} value={article.title}
        onChange={event => latest.current.onChange({ ...latest.current.article, title: event.target.value.replace(/[\r\n]+/g, ' ') })}
        onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); editor.commands.focus('start'); } }} />}
      <div className={`text-editor-body${!disabled && editor.isEmpty ? ' text-editor-body--empty' : ''}`}>
        <EditorContent editor={editor} />
        {!disabled && editor.isEmpty && <span className="text-editor-placeholder" aria-hidden="true">{titlePlaceholder ? 'Start writing…' : 'Type text…'}</span>}
      </div>
    </div>
    </ArticleFocusWriting>
  </>;
}
