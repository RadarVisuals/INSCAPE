import ModuleSurfaceControls from '../public/ownerSystemWorkflow/ModuleSurfaceControls.jsx';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { X } from '../public/InscapeIcons.jsx';
import { ARTICLE_FONTS, textAppearance } from './domain/article.js';
import './text.css';

export default function TextTools({ article, onChange, controlsRef, onClose, disabled, children, initialX = 760, initialY = 72 }) {
  const appearance = textAppearance(article);
  const changeAppearance = patch => onChange({ ...article, appearance: { ...appearance, ...patch } });
  return <WorkbenchWindow label="Text tools" title={article.title || 'Untitled text'} chrome="bevel" className="text-tools-window" width={320} initialHeight={590}
    initialX={initialX} initialY={initialY} resizableWidth controls={<button type="button" className="system-workflow__round-control" aria-label="Close Text tools" onClick={onClose}><X /></button>}>
    <div className="text-controls-body">
      <div ref={controlsRef} />
      <section className="text-settings" aria-label="Text settings">
        <label>Title (optional)<input aria-label="Article title" spellCheck={false} autoCorrect="off" autoCapitalize="off" value={article.title} maxLength={160} disabled={disabled} onChange={e => onChange({ ...article, title: e.target.value })} /></label>
        <label>Document font<select aria-label="Document font" disabled={disabled} value={article.font} onChange={e => onChange({ ...article, font: e.target.value })}>{ARTICLE_FONTS.map(font => <option key={font.id} value={font.id}>{font.label}</option>)}</select></label>
        {article.title && <label>Title size<input aria-label="Title size" type="number" min={8} max={300} value={appearance.titleFontSize ?? 28} disabled={disabled} onChange={e => { const value = e.target.valueAsNumber; if (Number.isFinite(value) && value >= 8 && value <= 300) changeAppearance({ titleFontSize: value }); }} /></label>}
        <label>Text size<input aria-label="Text size" type="number" min={8} max={300} value={appearance.fontSize} disabled={disabled} onChange={e => { const value = Number(e.target.value); if (value >= 8 && value <= 300) changeAppearance({ fontSize: value }); }} /></label>
        <label>Inner spacing<select aria-label="Text inner spacing" disabled={disabled} value={appearance.padding ? 'custom' : 'auto'} onChange={e => {
          if (e.target.value === 'auto') {
            const { padding, ...rest } = appearance;
            onChange({ ...article, appearance: rest });
          } else {
            const space = appearance.compact ? 0 : globalThis.matchMedia('(max-width: 600px)').matches ? 16 : 24;
            changeAppearance({ padding: { top: space, right: space, bottom: space, left: space } });
          }
        }}><option value="auto">Automatic</option><option value="custom">Custom</option></select></label>
        {appearance.padding && <div className="text-padding-controls">
          {['top', 'right', 'bottom', 'left'].map(side => <label key={side}>{side[0].toUpperCase() + side.slice(1)} (px)<input
            aria-label={`Text padding ${side}`} type="number" min={0} max={512} step={1} disabled={disabled} value={appearance.padding[side]}
            onChange={e => { const value = e.target.valueAsNumber; if (Number.isFinite(value) && value >= 0 && value <= 512) changeAppearance({ padding: { ...appearance.padding, [side]: value } }); }} /></label>)}
        </div>}
        <label>Text colour<input aria-label="Text colour" type="color" disabled={disabled} value={appearance.color} onChange={e => changeAppearance({ color: e.target.value })} /></label>
        <label>Background<select aria-label="Text background" disabled={disabled} value={appearance.background === null ? 'none' : 'colour'} onChange={e => changeAppearance({ background: e.target.value === 'none' ? null : '#101111' })}><option value="none">None</option><option value="colour">Colour</option></select></label>
        {appearance.background !== null && <>
          <label>Background colour<input aria-label="Text background colour" type="color" disabled={disabled} value={appearance.background} onChange={e => changeAppearance({ background: e.target.value })} /></label>
          <label>Background opacity<input aria-label="Text background opacity" type="range" min={0} max={1} step={.01} disabled={disabled} value={appearance.opacity} onChange={e => changeAppearance({ opacity: Number(e.target.value) })} /></label>
        </>}
        <ModuleSurfaceControls value={appearance.edges} onChange={edges => changeAppearance({ edges })} frame={appearance.frame} onFrameChange={frame => changeAppearance({ frame })} disabled={disabled} />
        {children}
      </section>
    </div>
  </WorkbenchWindow>;
}
