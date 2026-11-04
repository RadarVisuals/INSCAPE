import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import ToolPanel from '../public/ownerSystemWorkflow/WorkbenchToolPanel.jsx';
import { applyReceptionLayout, generateReceptionLayout, receptionLayoutCountRange, RECEPTION_LAYOUT_DEFAULTS } from './receptionLayoutGenerator.js';
import { receptionBentoSettings } from './receptionBento.js';
import { useInterfaceTheme } from '../interfaceTheme.js';

const Control = props => <button className="workflow-tactile-control" type="button" {...props} />;
const Field = ({ label, value, onChange, min, max, placeholder }) => <label>{label}<input type="number" min={min} max={max} step="1"
  placeholder={placeholder} value={value === null || Number.isNaN(value) ? '' : value}
  onChange={event => onChange(event.target.valueAsNumber)} /></label>;
function GeometryFields({ settings, change }) {
  return <>
    <div className="reception-bento-formats" role="group" aria-label="Start format">
      {[['Landscape', 1440, 900], ['Square', 1080, 1080], ['Portrait', 900, 1440]].map(([label, width, height]) =>
        <Control key={label} aria-pressed={settings.width === width && settings.height === height}
          title={`${width} × ${height} px`} onClick={() => change({ width, height })}>{label}</Control>)}
    </div>
    <div className="reception-bento-fields">
      {[['width', 'Width (px)', 320, 16384], ['height', 'Height (px)', 320, 16384], ['gap', 'Gutter (px)', 0, 256], ['padding', 'Outer margin (px)', 0, 256]]
        .map(([key, label, min, max]) => <Field key={key} {...{ label, min, max }} value={settings[key]} onChange={value => change({ [key]: value })} />)}
    </div>
  </>;
}

export default function ReceptionBentoPanel({ reception, onClose, run, generate, blocked, navigationTop, previewSettings, cancelPreview, revision, selectedId, structureActions }) {
  const panel = useRef(null), empty = !reception.cells.length;
  const [mode, setMode] = useState(empty ? 'new' : 'current');
  const [firstSeed] = useState(() => Math.floor(Math.random() * 4294967296));
  const [variant, setVariant] = useState(0);
  // The proposal survives changes to the current grid. It is revalidated against
  // the latest contents below; only Generate can turn it into authored state.
  const [proposalSettings, setProposalSettings] = useState(() => empty ? RECEPTION_LAYOUT_DEFAULTS
    : { ...receptionBentoSettings(reception), radius: 0 });
  useLayoutEffect(() => cancelPreview, [cancelPreview]);
  useLayoutEffect(() => {
    const returnFocus = document.activeElement;
    panel.current?.querySelector('input')?.focus({ preventScroll: true });
    return () => { if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); };
  }, []);
  const [frame, setFrame] = useState(() => ({ left: innerWidth - 340, top: navigationTop + 16, width: 324, height: Math.min(760, innerHeight - navigationTop - 32) }));
  return <ToolPanel title="Bento" label="Bento settings" closeLabel="Close Bento" chrome="flat"
    frame={frame} onFrameChange={setFrame} onClose={onClose} navigationTop={navigationTop}
    minimumWidth={290} minimumHeight={360} className="reception-bento-panel workbench-tool-controls"
    role="dialog" panelRef={panel} data-workflow-material="tactile" data-workflow-finish="flat" data-workbench-selection-tools data-system-workflow-overlay
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <div className="reception-bento-modes" role="group" aria-label="Bento task">
      <Control disabled={empty} aria-pressed={mode === 'current'} onClick={() => { cancelPreview(); setMode('current'); }}>Current grid</Control>
      <Control aria-pressed={mode === 'new'} onClick={() => { cancelPreview(); setMode('new'); }}>New layout</Control>
    </div>
    {mode === 'current' && !empty ? <CurrentGrid key={revision} {...{ reception, run, blocked, previewSettings, cancelPreview, selectedId, structureActions }} />
      : <NewLayout {...{ reception, blocked, variant, setVariant }} settings={proposalSettings} setSettings={setProposalSettings} seed={(firstSeed + variant) >>> 0}
        generate={(settings, seed) => { generate(settings, seed); setMode('current'); }} />}
  </ToolPanel>;
}
function CurrentGrid({ reception, run, blocked, previewSettings, cancelPreview, selectedId, structureActions }) {
  const { mode } = useInterfaceTheme(), saved = receptionBentoSettings(reception);
  const [patch, setPatch] = useState({}), [error, setError] = useState('');
  const settings = { ...saved, ...patch };
  const change = update => {
    const next = { ...patch, ...update }; setPatch(next); setError('');
    if ('gap' in update || 'radius' in update) {
      const preview = Object.fromEntries(['gap', 'radius'].filter(key => Object.hasOwn(next, key)).map(key => [key, next[key]]));
      try { previewSettings(preview); } catch (failure) { cancelPreview(); setError(failure.message); }
    }
  };
  const perform = action => { try { action(); setError(''); } catch (failure) { setError(failure.message); } };
  const pending = Object.entries(patch).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(saved[key]));
  const selected = reception.cells.find(cell => cell.id === selectedId);
  return <form className="reception-bento-settings" onSubmit={event => { event.preventDefault(); perform(() => run('settings', [patch])); }}>
    <div className="reception-bento-scroll">
      <fieldset disabled={blocked}><legend>Whole Bento</legend>
        <GeometryFields {...{ settings, change }} />
        <Field label="Corner radius (px)" min={0} max={160} value={settings.radius} placeholder="Mixed" onChange={radius => change({ radius })} />
        {saved.radius === null && <p>Cells have different radii. Enter a value to change all cells.</p>}
        <label className="reception-bento-check"><input type="checkbox" checked={settings.showFrame}
          onChange={event => change({ showFrame: event.target.checked })} />Show outer frame</label>
        <label className="reception-bento-check"><input type="checkbox" checked={Boolean(settings.innerLines)}
          onChange={event => change({ innerLines: event.target.checked ? { width: 1, color: mode === 'light' ? '#171717' : '#ebece7', opacity: 1 } : null })} />Show inner lines</label>
        {settings.innerLines && <p>Select a cell, then choose Color → Bento inner lines for the shared outline.</p>}
        <p>Gutter and radius preview live. Apply to save; closing discards the preview.</p>
      </fieldset>
      {selected && <SelectedCell key={selected.id} {...{ selected, reception, run, perform, structureActions }} blocked={blocked || pending} />}
      <fieldset disabled={blocked || pending}><legend>Extend this grid</legend>
        <Control disabled={reception.cells.length >= receptionLayoutCountRange(reception).max} onClick={() => perform(() => run('appendRow', []))}>Add row below</Control>
        <p>Adds one full-width cell below. Existing cells keep their size.</p>
      </fieldset>
      <p>Drag cells to swap; drag shared edges to resize. Double-click a cell to edit its contents.</p>
      <p>Text wraps at smaller preview widths. Check Canvas → Preview before publishing.</p>
    </div>
    <footer className="reception-bento-footer">
      {error && <p role="alert">{error}</p>}
      <Control type="submit" disabled={blocked || !pending}>Apply settings</Control>
    </footer>
  </form>;
}
function SelectedCell({ selected, reception, run, perform, blocked, structureActions }) {
  const [radius, setRadius] = useState(selected.radius || 0);
  return <fieldset disabled={blocked}><legend>Selected cell · {reception.shapes.find(shape => shape.id === selected.id)?.name || 'Cell'}</legend>
    <Field label="Selected cell radius (px)" min={0} max={160} value={radius} onChange={setRadius} />
    <Control disabled={radius === (selected.radius || 0)} onClick={() => perform(() => run('cellRadius', [selected.id, radius]))}>Apply cell radius</Control>
    <p>Color edits this cell’s fill and outline; Shape edits its name. Whole Bento settings above affect every cell.</p>
    <details><summary>Split or merge this cell</summary><div className="reception-bento-fields">
      {structureActions.map(action => <Control key={action.id} disabled={action.disabled} title={action.reason} onClick={() => perform(action.run)}>{action.label}</Control>)}
    </div></details>
  </fieldset>;
}
function NewLayout({ reception, settings, setSettings, seed, variant, setVariant, generate, blocked }) {
  const empty = !reception.cells.length, range = receptionLayoutCountRange(reception);
  const [error, setError] = useState('');
  const change = patch => { setSettings(current => ({ ...current, ...patch })); setError(''); };
  const proposal = useMemo(() => {
    try {
      if (settings.count < range.min || settings.count > range.max) throw new Error(`Choose ${range.min}–${range.max} cells to retain existing content.`);
      // Validate the actual placement of existing content, not just empty tiles.
      applyReceptionLayout(reception, settings, seed);
      return { layout: generateReceptionLayout(settings, seed) };
    } catch (failure) { return { error: failure.message }; }
  }, [reception, settings, seed, range.min, range.max]);
  return <form className="reception-bento-settings" onSubmit={event => {
    event.preventDefault(); try { generate(settings, seed); setError(''); } catch (failure) { setError(failure.message); }
  }}>
    <div className="reception-bento-scroll">
      <fieldset disabled={blocked}><legend>{empty ? 'Create your Bento' : 'Replace the arrangement'}</legend>
        <p>{empty ? 'Start with one cell and split it yourself, or choose a generated layout.' : 'Existing cells keep their contents and style. Undo restores the previous layout.'}</p>
        <Field label="Number of cells" min={range.min} max={range.max} value={settings.count} onChange={count => change({ count })} />
        <GeometryFields {...{ settings, change }} />
        <Field label="New cell radius (px)" min={0} max={160} value={settings.radius} onChange={radius => change({ radius })} />
        {proposal.layout && <svg className="reception-bento-preview" role="img" aria-label={`${settings.count} cells preview`} viewBox={`0 0 ${settings.width} ${settings.height}`}>
          {proposal.layout.rectangles.map((r, index) => <rect key={index} x={r.left} y={r.top} width={r.width} height={r.height} rx={settings.radius} />)}
        </svg>}
        <div className="reception-bento-fields">
          <Control disabled={variant === 0} onClick={() => setVariant(value => value - 1)}>Previous layout</Control>
          <Control onClick={() => setVariant(value => value + 1)}>Another layout</Control>
        </div>
      </fieldset>
    </div>
    <footer className="reception-bento-footer">
      {(error || proposal.error) && <p role="alert">{error || proposal.error}</p>}
      <Control type="submit" disabled={blocked || !proposal.layout}>{empty ? 'Create Bento' : 'Replace layout'}</Control>
    </footer>
  </form>;
}
