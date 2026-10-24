import { useId, useLayoutEffect, useRef } from 'react';
import ModuleSurfaceControls from '../public/ownerSystemWorkflow/ModuleSurfaceControls.jsx';
import { SharedTextToolsContent, useSharedTextTools } from './SharedTextTools.jsx';
import { X, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { ARTICLE_FONTS, ARTICLE_FONT_SIZE, ARTICLE_TRACKING, ARTICLE_BLOCK_SPACING, ARTICLE_LINE_HEIGHT, textAppearance, validArticleFontSize } from './domain/article.js';
import TextTypographyInput from './TextTypographyInput.jsx';
import TextStyleControls from './TextStyleControls.jsx';
import TextBackupControls from './TextBackupControls.jsx';
import './text.css';

export default function TextTools({ targetId, sharedColour = false, available = true, article, onChange, controlsRef, onClose, disabled, children, connection, readOptions, publication, footer, anchor, backupScope = targetId, recoveryPending = false }) {
  const { section, setSection } = useSharedTextTools();
  const id = useId(), body = useRef(null);
  useLayoutEffect(() => {
    const scroll = body.current?.closest('.text-tools-content');
    if (scroll) scroll.scrollTop = 0;
  }, [section]);
  const appearance = textAppearance(article);
  const changeAppearance = patch => onChange({ ...article, appearance: { ...appearance, ...patch } });
  return <SharedTextToolsContent targetId={targetId} available={available} label={article.title || 'Untitled text'} anchor={anchor} onClose={onClose}>
    <div className="text-controls-body" ref={body}>
      <div className="text-tool-tabs" role="tablist" aria-label="Text settings">
        {[['format', 'Format text'], ['article', 'Article settings']].map(([value, label], index) => <button type="button" role="tab" key={value}
          id={`${id}-${value}-tab`} aria-controls={`${id}-${value}`} aria-selected={section === value} tabIndex={section === value ? 0 : -1}
          onMouseDown={event => event.preventDefault()} onClick={() => setSection(value)} onKeyDown={event => {
            const next = { ArrowLeft: 1 - index, ArrowRight: 1 - index, Home: 0, End: 1 }[event.key];
            if (next === undefined) return;
            event.preventDefault(); setSection(next ? 'article' : 'format');
            event.currentTarget.parentElement.children[next].focus();
          }}>{label}</button>)}
      </div>
      <section role="tabpanel" id={`${id}-format`} aria-labelledby={`${id}-format-tab`} hidden={section !== 'format'}>
        <div ref={controlsRef} />
      </section>
      <section role="tabpanel" id={`${id}-article`} aria-labelledby={`${id}-article-tab`} hidden={section !== 'article'}>
      <div className="text-tool-scope"><strong>Whole article</strong>
        <p>Set the article’s starting style and layout.</p></div>
      <section className="text-tool-group" aria-label="Default text style">
        <h3>Default text style</h3>
        <p className="text-default-preview">{ARTICLE_FONTS.find(font => font.id === article.font).label} · {appearance.fontSize} px</p>
        <details className="text-default-settings">
        <summary>Change default style</summary>
        <p className="text-group-hint">Used throughout this article. Text you’ve given its own font or size keeps that choice.</p>
        <div className="text-settings text-settings--type" aria-label="Document typography">
          <label className="text-settings-wide">Default font<select aria-label="Default font" disabled={disabled} value={article.font} onChange={e => onChange({ ...article, font: e.target.value })}>{ARTICLE_FONTS.map(font => <option key={font.id} value={font.id}>{font.label}</option>)}</select></label>
          <label>Default size<input aria-label="Default text size" type="number" min={ARTICLE_FONT_SIZE.min} max={ARTICLE_FONT_SIZE.max} value={appearance.fontSize} disabled={disabled} onChange={e => { const value = Number(e.target.value); if (validArticleFontSize(value)) changeAppearance({ fontSize: value, scale: 1 }); }} /></label>
          {!sharedColour && <label>Text colour<input aria-label="Text colour" type="color" disabled={disabled} value={appearance.color} onChange={e => changeAppearance({ color: e.target.value })} /></label>}
          <div className="text-settings-wide">
            <TextTypographyInput label="Default line spacing (×)" accessibleLabel="Default line spacing" value={appearance.lineHeight}
              limits={ARTICLE_LINE_HEIGHT} disabled={disabled} placeholder={appearance.compact ? '1.2' : '1.65'} resetLabel="Use default document line spacing"
              onChange={value => {
                if (value === null) { const { lineHeight, ...rest } = appearance; onChange({ ...article, appearance: rest }); }
                else changeAppearance({ lineHeight: value });
              }} />
          </div>
          <TextStyleControls sharedColour={sharedColour} appearance={appearance} defaultFont={article.font} disabled={disabled} onChange={value => onChange({ ...article, appearance: value })} />
        </div>
        </details>
      </section>
      <section className="text-tool-group" aria-label="Article layout"><h3>Layout</h3>
      <details className="text-inspector-section">
        <summary>Title</summary>
        <div className="text-settings text-settings--type">
          {!article.title && <p className="text-tools-hint">Type a title above the article body, then set its appearance here.</p>}
          <label className="text-settings-wide">Title size<input aria-label="Title size" type="number" min={ARTICLE_FONT_SIZE.min} max={ARTICLE_FONT_SIZE.max} value={appearance.titleFontSize ?? 28} disabled={disabled || !article.title} onChange={e => { const value = e.target.valueAsNumber; if (validArticleFontSize(value)) changeAppearance({ titleFontSize: value }); }} /></label>
          <div className="text-title-controls text-settings-wide" role="group" aria-label="Title appearance">
            <TextTypographyInput label="Title gap (px)" accessibleLabel="Title gap" value={appearance.titleGap}
              limits={ARTICLE_BLOCK_SPACING} disabled={disabled || !article.title} resetLabel="Use automatic title gap" placeholder="20"
              onChange={value => { if (value === null) { const { titleGap, ...rest } = appearance; onChange({ ...article, appearance: rest }); }
                else changeAppearance({ titleGap: value }); }} />
            <TextTypographyInput label="Title tracking (em)" accessibleLabel="Title tracking" value={appearance.titleLetterSpacing}
              limits={ARTICLE_TRACKING} disabled={disabled || !article.title} resetLabel="Use default title tracking"
              onChange={value => { if (value === null) { const { titleLetterSpacing, ...rest } = appearance; onChange({ ...article, appearance: rest }); }
                else changeAppearance({ titleLetterSpacing: value }); }} />
            <span>Title alignment</span>
            <div className="text-title-alignment">{[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([value, Icon]) =>
              <button className="workflow-tactile-control" type="button" key={value} aria-label={`Align title ${value}`} title={`Align title ${value}`} disabled={disabled}
                aria-pressed={(appearance.titleAlignment || 'left') === value} onClick={() => changeAppearance({ titleAlignment: value })}><Icon /></button>)}</div>
            {!sharedColour && <div className="text-selection-colour"><label>Title colour<input aria-label="Title colour" type="color" disabled={disabled}
              value={appearance.titleColor || appearance.color} onChange={event => changeAppearance({ titleColor: event.target.value })} /></label>
              <button className="workflow-tactile-control" type="button" aria-label="Use document title colour" title="Use document text colour" disabled={disabled || !appearance.titleColor}
                onClick={() => { const { titleColor, ...rest } = appearance; onChange({ ...article, appearance: rest }); }}><X /></button></div>}
          </div>
        </div>
      </details>
      <details className="text-inspector-section">
        <summary>Text box layout</summary>
        <div className="text-settings text-settings--appearance">
          <label>Columns<select aria-label="Text columns" disabled={disabled} value={appearance.columns || 1} onChange={event => changeAppearance({ columns: Number(event.target.value) })}>
            <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label>
          {appearance.columns > 1 && <label>Column gap<input aria-label="Text column gap" type="number" min={0} max={128} disabled={disabled} value={appearance.columnGap ?? 24}
            onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value) && value >= 0 && value <= 128) changeAppearance({ columnGap: value }); }} /></label>}
          <label className="text-settings-wide">Inner spacing<select aria-label="Text inner spacing" disabled={disabled} value={appearance.padding ? 'custom' : 'auto'} onChange={e => {
            if (e.target.value === 'auto') {
              const { padding, ...rest } = appearance;
              onChange({ ...article, appearance: rest });
            } else {
              const space = appearance.compact ? 0 : globalThis.matchMedia('(max-width: 600px)').matches ? 16 : 24;
              changeAppearance({ padding: { top: space, right: space, bottom: space, left: space } });
            }
          }}><option value="auto">Automatic</option><option value="custom">Custom</option></select></label>
          {appearance.padding && <div className="text-padding-controls text-settings-wide">
            {['top', 'right', 'bottom', 'left'].map(side => <label key={side}>{side[0].toUpperCase() + side.slice(1)} (px)<input
              aria-label={`Text padding ${side}`} type="number" min={0} max={512} step={1} disabled={disabled} value={appearance.padding[side]}
              onChange={e => { const value = e.target.valueAsNumber; if (Number.isFinite(value) && value >= 0 && value <= 512) changeAppearance({ padding: { ...appearance.padding, [side]: value } }); }} /></label>)}
          </div>}
          {readOptions}
        </div>
      </details>
      <details className="text-inspector-section">
        <summary>Background &amp; edges</summary>
        <div className="text-settings text-settings--appearance">
          {!sharedColour && <><label>Background<select aria-label="Text background" disabled={disabled} value={appearance.background === null ? 'none' : 'colour'} onChange={e => changeAppearance({ background: e.target.value === 'none' ? null : '#101111' })}><option value="none">None</option><option value="colour">Colour</option></select></label>
          {appearance.background !== null && <>
            <label>Background colour<input aria-label="Text background colour" type="color" disabled={disabled} value={appearance.background} onChange={e => changeAppearance({ background: e.target.value })} /></label>
            <label className="text-settings-wide">Opacity <output>{Math.round(appearance.opacity * 100)}%</output><input aria-label="Text background opacity" type="range" min={0} max={1} step={.01} disabled={disabled} value={appearance.opacity} onChange={e => changeAppearance({ opacity: Number(e.target.value) })} /></label>
          </>}
          </>}
          <ModuleSurfaceControls value={appearance.edges} onChange={edges => changeAppearance({ edges })} frame={appearance.frame} onFrameChange={frame => changeAppearance({ frame })} disabled={disabled} />
        </div>
      </details>
      </section>
      <section className="text-tool-group" aria-label="Article management"><h3>Manage article</h3>
      {(connection || children) && <details className="text-inspector-section text-inspector-connections">
        <summary>Display connection</summary>
        {connection && <div className="text-settings text-settings--connection">{connection}</div>}
        {children && <div className="text-settings text-settings--options">{children}</div>}
      </details>}
      <TextBackupControls key={backupScope} article={article} onChange={onChange} disabled={disabled || !available} recoveryPending={recoveryPending} />
      {publication && <div className="text-inspector-publication">{publication}</div>}
      </section>
      </section>
    </div>
    {footer && <footer className="text-tools-footer">{footer}</footer>}
  </SharedTextToolsContent>;
}
