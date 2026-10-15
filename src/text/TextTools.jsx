import ModuleSurfaceControls from '../public/ownerSystemWorkflow/ModuleSurfaceControls.jsx';
import { SharedTextToolsContent } from './SharedTextTools.jsx';
import { X, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { ARTICLE_FONTS, ARTICLE_TRACKING, ARTICLE_BLOCK_SPACING, ARTICLE_LINE_HEIGHT, textAppearance } from './domain/article.js';
import TextTypographyInput from './TextTypographyInput.jsx';
import TextStyleControls from './TextStyleControls.jsx';
import TextBackupControls from './TextBackupControls.jsx';
import './text.css';

export default function TextTools({ targetId, available = true, article, onChange, controlsRef, onClose, disabled, children, connection, readOptions, publication, footer, anchor, backupScope = targetId, recoveryPending = false }) {
  const appearance = textAppearance(article);
  const changeAppearance = patch => onChange({ ...article, appearance: { ...appearance, ...patch } });
  return <SharedTextToolsContent targetId={targetId} available={available} label={article.title || 'Untitled text'} anchor={anchor} onClose={onClose}>
    <div className="text-controls-body">
      <section aria-label="Current text formatting">
        <div ref={controlsRef} />
      </section>
      <details className="text-inspector-section">
        <summary>Default text style</summary>
        <p className="text-inspector-context">Used throughout this article. Individually formatted text keeps its overrides.</p>
        <div className="text-settings text-settings--type" aria-label="Document typography">
          <label className="text-settings-wide">Font<select aria-label="Document font" disabled={disabled} value={article.font} onChange={e => onChange({ ...article, font: e.target.value })}>{ARTICLE_FONTS.map(font => <option key={font.id} value={font.id}>{font.label}</option>)}</select></label>
          <label>Text size<input aria-label="Text size" type="number" min={8} max={300} value={appearance.fontSize} disabled={disabled} onChange={e => { const value = Number(e.target.value); if (value >= 8 && value <= 300) changeAppearance({ fontSize: value, scale: 1 }); }} /></label>
          <label>Text colour<input aria-label="Text colour" type="color" disabled={disabled} value={appearance.color} onChange={e => changeAppearance({ color: e.target.value })} /></label>
          <div className="text-settings-wide">
            <TextTypographyInput label="Line spacing (×)" accessibleLabel="Document line spacing" value={appearance.lineHeight}
              limits={ARTICLE_LINE_HEIGHT} disabled={disabled} placeholder={appearance.compact ? '1.2' : '1.65'} resetLabel="Use default document line spacing"
              onChange={value => {
                if (value === null) { const { lineHeight, ...rest } = appearance; onChange({ ...article, appearance: rest }); }
                else changeAppearance({ lineHeight: value });
              }} />
          </div>
          <TextStyleControls appearance={appearance} disabled={disabled} onChange={value => onChange({ ...article, appearance: value })} />
        </div>
      </details>
      <details className="text-inspector-section">
        <summary>Title</summary>
        <div className="text-settings text-settings--type">
          {!article.title && <p className="text-tools-hint">Type a title above the article body, then set its appearance here.</p>}
          <label className="text-settings-wide">Title size<input aria-label="Title size" type="number" min={8} max={300} value={appearance.titleFontSize ?? 28} disabled={disabled || !article.title} onChange={e => { const value = e.target.valueAsNumber; if (Number.isFinite(value) && value >= 8 && value <= 300) changeAppearance({ titleFontSize: value }); }} /></label>
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
            <div className="text-selection-colour"><label>Title colour<input aria-label="Title colour" type="color" disabled={disabled}
              value={appearance.titleColor || appearance.color} onChange={event => changeAppearance({ titleColor: event.target.value })} /></label>
              <button className="workflow-tactile-control" type="button" aria-label="Use document title colour" title="Use document text colour" disabled={disabled || !appearance.titleColor}
                onClick={() => { const { titleColor, ...rest } = appearance; onChange({ ...article, appearance: rest }); }}><X /></button></div>
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
          <label>Background<select aria-label="Text background" disabled={disabled} value={appearance.background === null ? 'none' : 'colour'} onChange={e => changeAppearance({ background: e.target.value === 'none' ? null : '#101111' })}><option value="none">None</option><option value="colour">Colour</option></select></label>
          {appearance.background !== null && <>
            <label>Background colour<input aria-label="Text background colour" type="color" disabled={disabled} value={appearance.background} onChange={e => changeAppearance({ background: e.target.value })} /></label>
            <label className="text-settings-wide">Opacity <output>{Math.round(appearance.opacity * 100)}%</output><input aria-label="Text background opacity" type="range" min={0} max={1} step={.01} disabled={disabled} value={appearance.opacity} onChange={e => changeAppearance({ opacity: Number(e.target.value) })} /></label>
          </>}
          <ModuleSurfaceControls value={appearance.edges} onChange={edges => changeAppearance({ edges })} frame={appearance.frame} onFrameChange={frame => changeAppearance({ frame })} disabled={disabled} />
        </div>
      </details>
      {(connection || children) && <details className="text-inspector-section text-inspector-connections">
        <summary>Display connection</summary>
        {connection && <div className="text-settings text-settings--connection">{connection}</div>}
        {children && <div className="text-settings text-settings--options">{children}</div>}
      </details>}
      <TextBackupControls key={backupScope} article={article} onChange={onChange} disabled={disabled || !available} recoveryPending={recoveryPending} />
    </div>
    {publication && <div className="text-inspector-publication">{publication}</div>}
    {footer && <footer className="text-tools-footer">{footer}</footer>}
  </SharedTextToolsContent>;
}
