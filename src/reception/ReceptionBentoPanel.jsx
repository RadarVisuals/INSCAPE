import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import ToolPanel from '../public/ownerSystemWorkflow/WorkbenchToolPanel.jsx';
import { applyReceptionLayout, receptionLayoutCountRange, RECEPTION_LAYOUT_DEFAULTS } from './receptionLayoutGenerator.js';
import { receptionBentoSettings } from './receptionBento.js';
import { receptionModuleWindow, visibleReceptionInnerLines } from './receptionEditorDocument.js';
import { useInterfaceTheme } from '../interfaceTheme.js';
import { OwnerSystemWorkflowSelectMenu } from '../public/ownerSystemWorkflow/OwnerSystemWorkflowWorkspaceControls.jsx';

const Control = props => <button className="workflow-tactile-control" type="button" {...props} />;
const Field = ({ label, prefix, value, onChange, min, max, placeholder, optional = false, title, commit = false, preview }) => {
  const shown = value === null || Number.isNaN(value) ? '' : value;
  return <label className="reception-bento-field" title={title}>
    {prefix && <span aria-hidden="true">{prefix}</span>}<input key={commit ? shown : undefined} aria-label={label} type="number" min={min} max={max} step="1" required={!optional}
    placeholder={placeholder} {...(commit ? { defaultValue: shown } : { value: shown })}
    onChange={event => { const next = optional && event.target.value === '' ? null : event.target.valueAsNumber;
      if (commit) preview?.(next); else onChange(next);
    }}
    onBlur={event => {
      if (!commit) return;
      const input = event.currentTarget, next = input.valueAsNumber;
      if ((optional && input.value === '') || next === value) { preview?.(null); input.value = shown; return; }
      if (onChange(next) === false) input.value = shown;
    }}
    onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); event.currentTarget.blur(); }
      if (commit && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.currentTarget.value = shown; preview?.(null); }
    }} /></label>;
};
const FieldRow = ({ label, children }) => <div className="reception-bento-row"><span>{label}</span><div>{children}</div></div>;
const FORMATS = [['Landscape', 1440, 900], ['Square', 1080, 1080], ['Portrait', 900, 1440]];
function GeometryFields({ settings, change, commit = false, preview }) {
  const format = FORMATS.find(([_, width, height]) => settings.width === width && settings.height === height)?.[0] || '';
  return <>
    <FieldRow label="Format"><OwnerSystemWorkflowSelectMenu flat compact palette="editor" className="workflow-tactile-control reception-bento-format" label="Format" value={format}
      options={[...(!format ? [{ label: 'Custom', value: '' }] : []), ...FORMATS.map(([label]) => ({ label, value: label }))]}
      onChange={value => { const preset = FORMATS.find(([label]) => label === value); if (preset) change({ width: preset[1], height: preset[2] }); }} /></FieldRow>
    <FieldRow label="Size">
      <Field label="Width (px)" prefix="W" min={320} max={16384} commit={commit} value={settings.width} onChange={width => change({ width })} />
      <Field label="Height (px)" prefix="H" min={320} max={16384} commit={commit} value={settings.height} onChange={height => change({ height })} />
    </FieldRow>
    <FieldRow label="Spacing">
      <Field label="Gutter (px)" prefix="Gap" min={0} max={256} commit={commit} preview={preview && (gap => preview('gap', gap))} value={settings.gap} onChange={gap => change({ gap })} />
      <Field label="Outer margin (px)" prefix="Outer" min={0} max={256} commit={commit} value={settings.padding} onChange={padding => change({ padding })} />
    </FieldRow>
  </>;
}

export default function ReceptionBentoPanel({ reception, onClose, run, generate, blocked, navigationTop, previewSettings, cancelPreview }) {
  const panel = useRef(null), empty = !reception.cells.length;
  const [mode, setMode] = useState(empty ? 'new' : 'current');
  const [firstSeed] = useState(() => Math.floor(Math.random() * 4294967296));
  const [variant, setVariant] = useState(0);
  // The proposal survives changes to the current grid. It is revalidated against
  // the latest contents below; only Generate can turn it into authored state.
  const [proposalSettings, setProposalSettings] = useState(() => {
    if (empty) return RECEPTION_LAYOUT_DEFAULTS;
    const { count, width, height, gap, padding, radius } = receptionBentoSettings(reception);
    let columns = Math.min(4, Math.ceil(Math.sqrt(count)));
    while (count % columns) columns--;
    return { width, height, gap, padding, columns, rows: count / columns, radius: radius ?? 0 };
  });
  useLayoutEffect(() => cancelPreview, [cancelPreview]);
  useLayoutEffect(() => {
    const returnFocus = document.activeElement;
    panel.current?.querySelector('input')?.focus({ preventScroll: true });
    return () => { if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); };
  }, []);
  const [frame, setFrame] = useState(() => ({ left: innerWidth - 340, top: navigationTop + 16, width: 324, height: 1 }));
  return <ToolPanel title="Bento" label="Bento settings" closeLabel="Close Bento" chrome="flat"
    frame={frame} onFrameChange={setFrame} onClose={onClose} navigationTop={navigationTop}
    minimumWidth={290} fitContentHeight className="reception-bento-panel workbench-tool-controls"
    role="dialog" panelRef={panel} data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor" data-workbench-selection-tools data-system-workflow-overlay
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <div className="reception-bento-modes" role="group" aria-label="Bento task">
      <Control disabled={empty} aria-pressed={mode === 'current'} onClick={() => { cancelPreview(); setMode('current'); }}>Current grid</Control>
      <Control aria-pressed={mode === 'new'} onClick={() => { cancelPreview(); setMode('new'); }}>New layout</Control>
    </div>
    {mode === 'current' && !empty ? <CurrentGrid {...{ reception, run, blocked, previewSettings, cancelPreview }} />
      : <NewLayout {...{ reception, blocked, variant, setVariant, generate }} settings={proposalSettings} setSettings={setProposalSettings} seed={(firstSeed + variant) >>> 0} />}
  </ToolPanel>;
}
function CurrentGrid({ reception, run, blocked, previewSettings, cancelPreview }) {
  const { mode } = useInterfaceTheme(), settings = receptionBentoSettings(reception);
  const [error, setError] = useState('');
  const change = update => {
    try { run('settings', [update]); setError(''); return true; }
    catch (failure) { setError(failure.message); return false; }
  };
  const showInnerLines = visible => {
    const { hidden: _hidden, ...outline } = settings.innerLines ?? { width: 1, color: mode === 'light' ? '#171717' : '#ebece7', opacity: 1 };
    change({ innerLines: visible ? outline : { ...outline, hidden: true } });
  };
  const preview = (key, value) => {
    setError('');
    if (!Number.isFinite(value) || value < 0 || value > (key === 'gap' ? 256 : 160)) { cancelPreview(); return; }
    try { previewSettings({ [key]: value }); } catch (failure) { cancelPreview(); setError(failure.message); }
  };
  return <div className="reception-bento-settings">
    <div className="reception-bento-scroll">
      <fieldset disabled={blocked}><legend>Whole Bento</legend>
        <GeometryFields {...{ settings, change, preview }} commit />
        <FieldRow label="Radius"><Field label="Corner radius for all cells (px)" prefix="R" min={0} max={160} optional commit value={settings.radius}
          preview={radius => preview('radius', radius)} placeholder="Per cell" title="Set the corner radius for all cells." onChange={radius => change({ radius })} /></FieldRow>
        <div className="reception-bento-checks">
          <label className="reception-bento-check"><input type="checkbox" checked={settings.showFrame}
            onChange={event => change({ showFrame: event.target.checked })} />Show outer frame</label>
          <label className="reception-bento-check"><input type="checkbox" checked={Boolean(visibleReceptionInnerLines(settings.innerLines))}
            onChange={event => showInnerLines(event.target.checked)} />Show inner lines</label>
        </div>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </div>
  </div>;
}
function NewLayout({ reception, settings, setSettings, seed, variant, setVariant, generate, blocked }) {
  const empty = !reception.cells.length, range = receptionLayoutCountRange(reception);
  const [error, setError] = useState('');
  const change = patch => { setSettings(current => ({ ...current, ...patch })); setError(''); };
  const proposal = useMemo(() => {
    try {
      // Validate the actual placement of existing content, not just empty tiles.
      const candidate = applyReceptionLayout(reception, settings, seed), area = candidate.workbench.area;
      return { cells: candidate.cells.map(cell => {
        const frame = receptionModuleWindow(candidate, cell.id);
        return { ...frame, left: frame.left - area.left, top: frame.top - area.top, radius: cell.radius };
      }) };
    } catch (failure) { return { error: failure.message }; }
  }, [reception, settings, seed]);
  return <form className="reception-bento-settings" onSubmit={event => {
    event.preventDefault(); try { generate(settings, seed); setError(''); } catch (failure) { setError(failure.message); }
  }}>
    <div className="reception-bento-scroll">
      <fieldset disabled={blocked} aria-label="New layout">
        <FieldRow label="Cells">
          <Field label="Columns" prefix="Cols" min={1} max={range.max} value={settings.columns} onChange={columns => change({ columns })} />
          <Field label="Rows" prefix="Rows" min={1} max={range.max} value={settings.rows} onChange={rows => change({ rows })} />
        </FieldRow>
        <GeometryFields {...{ settings, change }} />
        {proposal.cells && <svg className="reception-bento-preview" role="img" aria-label={`${settings.columns} columns, ${settings.rows} rows preview`} viewBox={`0 0 ${settings.width} ${settings.height}`}>
          {proposal.cells.map((r, index) => <rect key={index} x={r.left} y={r.top} width={r.width} height={r.height} rx={r.radius} />)}
        </svg>}
        <div className="reception-bento-fields">
          <Control disabled={variant === 0} onClick={() => setVariant(value => value - 1)}>Previous layout</Control>
          <Control onClick={() => setVariant(value => value + 1)}>Another layout</Control>
        </div>
      </fieldset>
      <footer className="reception-bento-footer">
        {(error || proposal.error) && <p role="alert">{error || proposal.error}</p>}
        <Control type="submit" data-primary disabled={blocked || !proposal.cells}>{empty ? 'Create Bento' : 'Replace layout'}</Control>
      </footer>
    </div>
  </form>;
}
