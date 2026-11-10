import { useLayoutEffect, useRef } from 'react';
import ModuleSurfaceControls from '../public/ownerSystemWorkflow/ModuleSurfaceControls.jsx';
import { SharedTextToolsContent } from './SharedTextTools.jsx';
import { X, AlignLeft, AlignCenter, AlignRight, ChevronLeft } from 'lucide-react';
import { ARTICLE_FONTS, ARTICLE_FONT_SIZE, ARTICLE_BLOCK_SPACING, ARTICLE_LINE_HEIGHT, textAppearance, validArticleFontSize } from './domain/article.js';
import TextTypographyInput, { TitleTypographyInput } from './TextTypographyInput.jsx';
import TextStyleControls from './TextStyleControls.jsx';
import TextBackupControls from './TextBackupControls.jsx';
import './text.css';

export default function TextTools({ targetId, available = true, onClose, ...props }) {
  return <SharedTextToolsContent targetId={targetId} available={available} label={props.article.title || 'Untitled text'} onClose={onClose}>
    <TextToolsContent {...props} targetId={targetId} available={available} />
  </SharedTextToolsContent>;
}

// Content controls are independent of the Workbench window and its registration.
// A layout host can own the article's box without changing stored appearance.
export function TextToolsContent({ targetId, sharedColour = false, titleInput = false, frameLayout = false, defaultOverflow = 'scroll', available = true, article, onChange, controlsRef, disabled, children, connection, readOptions, publication, footer, backupScope = targetId, recoveryPending = false, containerControls = true, transform, color, position, information, onBackToCell, onEditText }) {
  const recovery = useRef(null);
  useLayoutEffect(() => { if (recoveryPending) recovery.current?.scrollIntoView({ block: 'nearest' }); }, [recoveryPending, footer]);
  const appearance = textAppearance(article);
  const changeAppearance = patch => onChange({ ...article, appearance: { ...appearance, ...patch } });
  return <div className="workbench-text-inspector text-tools-content" data-text-inspector data-workbench-inspection-target={targetId}>
    <div className="text-controls-body">
      {onEditText && <button className="workflow-tactile-control text-edit-action" type="button" disabled={disabled || recoveryPending || !available} onClick={onEditText}>Edit text</button>}
      <div className="text-formatting-host" ref={controlsRef} />
      <details className="text-inspector-section text-article-layout"><summary>Text box and article</summary>
      <details className="text-inspector-section">
        <summary>Title</summary>
        <div className="text-settings text-settings--type">
          {titleInput ? <><label className="text-settings-wide">Optional title<input aria-label="Optional text title" maxLength={160} disabled={disabled} value={article.title}
            onChange={event => onChange({ ...article, title: event.target.value })} /></label>
            <p className="text-tools-hint">Use a title for a separate heading. A name or label only needs the main text field.</p></>
            : !article.title && <p className="text-tools-hint">Type a title above the article body, then set its appearance here.</p>}
          <TitleTypographyInput {...{ article, onChange, disabled }} />
          <div className="text-title-controls text-settings-wide" role="group" aria-label="Title appearance">
            <TextTypographyInput label="Title gap (px)" accessibleLabel="Title gap" value={appearance.titleGap}
              limits={ARTICLE_BLOCK_SPACING} disabled={disabled || !article.title} resetLabel="Use automatic title gap" placeholder="20"
              onChange={value => { if (value === null) { const { titleGap, ...rest } = appearance; onChange({ ...article, appearance: rest }); }
                else changeAppearance({ titleGap: value }); }} />
            <TitleTypographyInput {...{ article, onChange, disabled }} tracking />
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
      {containerControls && <><details className="text-inspector-section" open>
        <summary>Text box layout</summary>
        <div className="text-settings text-settings--appearance">
          {frameLayout && <>
          <label>Writing direction<select aria-label="Text writing direction" value={appearance.writingDirection || 'horizontal'}
            disabled={disabled || appearance.columns > 1} onChange={event => changeAppearance({ writingDirection: event.target.value })}>
            <option value="horizontal">Horizontal</option><option value="stacked">Stacked letters ↓</option>
          </select></label>
          <label>Rotation<select aria-label="Text rotation" value={appearance.transform?.quarterTurns || 0} disabled={disabled}
            onChange={event => changeAppearance({ transform: { mirrorX: false, mirrorY: false, ...appearance.transform, quarterTurns: Number(event.target.value) } })}>
            {[0, 1, 2, 3].map(turns => <option key={turns} value={turns}>{turns * 90}°</option>)}
          </select></label>
          <label>Vertical alignment<select aria-label="Text vertical alignment" disabled={disabled || appearance.columns > 1} value={appearance.verticalAlign || 'top'}
            onChange={event => changeAppearance({ verticalAlign: event.target.value })}>
            <option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option>
          </select></label>
          <label>Overflow<select aria-label="Text overflow" disabled={disabled || appearance.columns > 1} value={appearance.overflow || defaultOverflow}
            onChange={event => changeAppearance({ overflow: event.target.value })}>
            <option value="clip">Clip at box edge</option><option value="scroll">Scroll</option>
          </select></label>
          <p>Alignment positions the text inside its box. Columns fill from the top. Choose Scroll for longer reading text.</p>
          </>}
          <label className="text-settings-wide">Text mode<select aria-label="Text spacing" disabled={disabled} value={appearance.compact ? 'compact' : 'article'}
            onChange={event => changeAppearance({ compact: event.target.value === 'compact' })}>
            <option value="compact">Compact · names and labels</option><option value="article">Article · paragraphs</option>
          </select></label>
          <label>Columns<select aria-label="Text columns" disabled={disabled || appearance.writingDirection === 'stacked'} value={appearance.columns || 1} onChange={event => changeAppearance({ columns: Number(event.target.value) })}>
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
      </details></>}
      </details>
      <details className="text-inspector-section text-default-settings">
        <summary>Default and heading styles</summary>
        <p className="text-default-preview">{ARTICLE_FONTS.find(font => font.id === article.font).label} · {appearance.fontSize} px</p>
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
      {(connection || children) && <details className="text-inspector-section text-inspector-connections">
        <summary>Display connection</summary>
        {connection && <div className="text-settings text-settings--connection">{connection}</div>}
        {children && <div className="text-settings text-settings--options">{children}</div>}
      </details>}
      <TextBackupControls key={backupScope} article={article} onChange={onChange} disabled={disabled || !available} recoveryPending={recoveryPending} />
      {position}
      {transform}
      {color}
      {information}
      {publication && <div className="text-inspector-publication">{publication}</div>}
      {onBackToCell && <button className="workflow-tactile-control text-back-to-cell" type="button" onClick={onBackToCell}><ChevronLeft />Back to cell</button>}
    </div>
    {footer && <footer ref={recovery} className="text-tools-footer">{footer}</footer>}
  </div>;
}
