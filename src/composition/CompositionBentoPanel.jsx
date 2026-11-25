import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ToolPanel from '../public/ownerSystemWorkflow/WorkbenchToolPanel.jsx';
import { applyCompositionLayout, compositionLayoutCountRange, COMPOSITION_LAYOUT_DEFAULTS } from './compositionLayoutGenerator.js';
import { compositionBentoSettings } from './compositionBento.js';
import { compositionModuleWindow, visibleCompositionInnerLines } from './compositionEditorDocument.js';
import { useInterfaceTheme } from '../interfaceTheme.js';
import { OwnerSystemWorkflowSelectMenu } from '../public/ownerSystemWorkflow/OwnerSystemWorkflowWorkspaceControls.jsx';
import CommittedColourControls, { CommittedOpacityControl } from '../colour/CommittedColourControls.jsx';
import EditorToolbarPopover from '../public/ownerSystemWorkflow/EditorToolbarPopover.jsx';
import { useEditorCells } from './EditorCellsContext.jsx';

const Control = props => <button className="workflow-tactile-control" type="button" {...props} />;
const Field = ({ label, prefix, value, onChange, min, max, placeholder, optional = false, title, commit = false, preview }) => {
  const shown = value === null || Number.isNaN(value) ? '' : value;
  return <label className="composition-bento-field" title={title}>
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
const FieldRow = ({ label, children }) => <div className="composition-bento-row"><span>{label}</span><div>{children}</div></div>;
const RANGE_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'];
// Keep numeric precision while a slider gesture previews once and commits once.
function RangeField({ label, numberLabel, value, max, commit = false, preview, onChange, getVersion, disabled, optional, title }) {
  const [draft, setDraft] = useState(null), active = useRef(null), cancelled = useRef(false);
  const version = getVersion?.();
  const finish = abandon => {
    const gesture = active.current;
    if (!gesture) return;
    active.current = null; cancelled.current = abandon; setDraft(null); preview?.(null);
    if (!abandon && !disabled && getVersion?.() === gesture.version && gesture.value !== value) onChange(gesture.value);
  };
  const begin = () => {
    cancelled.current = false;
    if (commit && !disabled && !active.current) active.current = { version: getVersion?.(), value, cancel: () => finish(true) };
  };
  useEffect(() => { active.current?.cancel(); }, [version, disabled]);
  useEffect(() => {
    const cancel = () => active.current?.cancel(), visibility = () => { if (document.hidden) cancel(); };
    window.addEventListener('blur', cancel); document.addEventListener('visibilitychange', visibility);
    return () => { cancel(); window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  return <FieldRow label={label}><div className="composition-bento-range">
    <input type="range" aria-label={label} aria-valuetext={value === null && draft === null ? 'Per cell' : undefined}
      min={0} max={max} step={1} value={draft ?? value ?? 0} disabled={disabled}
      onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.focus({ preventScroll: true }); begin(); event.currentTarget.setPointerCapture(event.pointerId); }}
      onChange={event => {
        if (disabled || cancelled.current) return;
        const next = Number(event.target.value);
        if (!commit || !active.current) { onChange(next); return; }
        if (getVersion?.() !== active.current.version) { finish(true); return; }
        active.current.value = next; setDraft(next); preview?.(next);
      }}
      onPointerUp={() => finish(false)} onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish(true)} onBlur={() => finish(true)}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(true); }
        else if (RANGE_KEYS.includes(event.key) && !event.repeat) begin();
      }} onKeyUp={event => { if (RANGE_KEYS.includes(event.key)) finish(false); }} />
    <Field label={numberLabel} min={0} max={max} commit={commit} value={draft ?? value} optional={optional} placeholder={optional ? 'Per cell' : undefined}
      title={title} preview={preview} onChange={onChange} />
  </div></FieldRow>;
}
const FORMATS = [['Landscape', 1440, 900], ['Square', 1080, 1080], ['Portrait', 900, 1440]];
function GeometryFields({ settings, change, commit = false, preview, getVersion, disabled }) {
  const format = FORMATS.find(([_, width, height]) => settings.width === width && settings.height === height)?.[0] || '';
  return <>
    <FieldRow label="Format"><OwnerSystemWorkflowSelectMenu flat compact palette="editor" className="workflow-tactile-control composition-bento-format" label="Format" value={format}
      options={[...(!format ? [{ label: 'Custom', value: '' }] : []), ...FORMATS.map(([label]) => ({ label, value: label }))]}
      onChange={value => { const preset = FORMATS.find(([label]) => label === value); if (preset) change({ width: preset[1], height: preset[2] }); }} /></FieldRow>
    <FieldRow label="Size">
      <Field label="Width (px)" prefix="W" min={320} max={16384} commit={commit} value={settings.width} onChange={width => change({ width })} />
      <Field label="Height (px)" prefix="H" min={320} max={16384} commit={commit} value={settings.height} onChange={height => change({ height })} />
    </FieldRow>
    <RangeField label="Gap" numberLabel="Gutter (px)" title={commit ? "Minimum distance between cells. Lowering it leaves existing spaces in place." : undefined} max={256} {...{ commit, getVersion, disabled }}
      preview={preview && (gap => preview('gap', gap))} value={settings.gap} onChange={gap => change({ gap })} />
    <RangeField label="Spacing" numberLabel="Outer margin (px)" max={256} {...{ commit, getVersion, disabled }}
      preview={preview && (padding => preview('padding', padding))} value={settings.padding} onChange={padding => change({ padding })} />
  </>;
}

export default function CompositionBentoPanel({ composition, onClose, run, generate, blocked, navigationTop, previewSettings, cancelPreview }) {
  const panel = useRef(null), empty = !composition.cells.length;
  const [mode, setMode] = useState(empty ? 'new' : 'current');
  const [firstSeed] = useState(() => Math.floor(Math.random() * 4294967296));
  const [variant, setVariant] = useState(0);
  // The proposal survives changes to the current grid. It is revalidated against
  // the latest contents below; only Generate can turn it into authored state.
  const [proposalSettings, setProposalSettings] = useState(() => {
    if (empty) return COMPOSITION_LAYOUT_DEFAULTS;
    const { count, width, height, gap, padding, radius } = compositionBentoSettings(composition);
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
    minimumWidth={290} fitContentHeight className="composition-bento-panel workbench-tool-controls"
    role="dialog" panelRef={panel} data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor" data-workbench-selection-tools data-system-workflow-overlay
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <div className="composition-bento-modes" role="group" aria-label="Bento task">
      <Control disabled={empty} aria-pressed={mode === 'current'} onClick={() => { cancelPreview(); setMode('current'); }}>Current grid</Control>
      <Control aria-pressed={mode === 'new'} onClick={() => { cancelPreview(); setMode('new'); }}>New layout</Control>
    </div>
    {mode === 'current' && !empty ? <CurrentGrid {...{ composition, run, blocked, previewSettings, cancelPreview }} />
      : <NewLayout {...{ composition, blocked, variant, setVariant, generate }} settings={proposalSettings} setSettings={setProposalSettings} seed={(firstSeed + variant) >>> 0} />}
  </ToolPanel>;
}
function CurrentGrid({ composition, run, blocked, previewSettings, cancelPreview }) {
  const { mode } = useInterfaceTheme(), settings = compositionBentoSettings(composition);
  const { store, previewAppearance } = useEditorCells();
  const [error, setError] = useState('');
  const change = update => {
    try { run('settings', [update]); setError(''); return true; }
    catch (failure) { setError(failure.message); return false; }
  };
  const colorPatch = (key, patch) => ({ ...('color' in patch ? { [key]: patch.color } : {}),
    ...('opacity' in patch ? { [key === 'surface' ? 'surfaceOpacity' : 'frameOpacity']: patch.opacity } : {}) });
  const showInnerLines = visible => {
    const { hidden: _hidden, ...outline } = settings.innerLines ?? { width: 1, color: mode === 'light' ? '#171717' : '#ebece7', opacity: 1 };
    change({ innerLines: visible ? outline : { ...outline, hidden: true } });
  };
  const preview = (key, value) => {
    setError('');
    if (!Number.isFinite(value) || value < 0 || value > (['gap', 'padding'].includes(key) ? 256 : 160)) {
      if (key === 'frameRadius') previewAppearance(null); else cancelPreview();
      return;
    }
    if (key === 'frameRadius') { previewAppearance({ frameRadius: value }); return; }
    try { previewSettings({ [key]: value }); } catch (failure) { cancelPreview(); setError(failure.message); }
  };
  return <div className="composition-bento-settings">
    <div className="composition-bento-scroll">
      <fieldset disabled={blocked}><legend>Whole Bento</legend>
        <GeometryFields {...{ settings, change, preview }} commit getVersion={store.getGeneration} disabled={blocked} />
        <RangeField label="Cell radius" numberLabel="Corner radius for all cells (px)" max={160} optional commit value={settings.radius}
          getVersion={store.getGeneration} disabled={blocked} preview={radius => preview('radius', radius)}
          title="Set the corner radius for all cells." onChange={radius => change({ radius })} />
        <RangeField label="Frame radius" numberLabel="Outer frame radius (px)" max={160} commit value={settings.frameRadius}
          getVersion={store.getGeneration} disabled={blocked} preview={frameRadius => preview('frameRadius', frameRadius)}
          title="Round the outer frame independently of cell corners." onChange={frameRadius => change({ frameRadius })} />
        <div className="composition-bento-checks">
          <label className="composition-bento-check"><input type="checkbox" checked={settings.showFrame}
            onChange={event => change({ showFrame: event.target.checked })} />Show outer frame</label>
          <label className="composition-bento-check"><input type="checkbox" checked={Boolean(visibleCompositionInnerLines(settings.innerLines))}
            onChange={event => showInnerLines(event.target.checked)} />Show inner lines</label>
        </div>
        <fieldset aria-label="Bento colors">
          {[
            ['frameColor', 'Frame line', mode === 'light' ? '#abaca9' : '#4c4c4b'],
            ['surface', 'Frame fill', mode === 'light' ? '#dedbd3' : '#171717'],
          ].map(([key, label, fallback]) => {
            const color = settings[key] || fallback, opacity = key === 'surface' ? settings.surfaceOpacity : settings.frameOpacity;
            const controls = { color, disabled: blocked, scopeKey: `composition:${key}`, getVersion: store.getGeneration,
              onPreview: patch => previewAppearance(patch ? colorPatch(key, patch) : null),
              onChange: patch => change(colorPatch(key, patch)) };
            return <FieldRow key={key} label={label}>
              <EditorToolbarPopover label={`${label} color`} className="composition-bento-color" disabled={blocked}
                trigger={<><span className="workbench-inspector-swatch" style={{ backgroundColor: color, opacity }} aria-hidden="true" />
                  <span>{color.slice(1).toUpperCase()}</span><span>{Math.round(opacity * 100)}%</span></>}>
                <strong>{label}</strong><CommittedColourControls {...controls} variant="inspector" />
                <CommittedOpacityControl {...controls} opacity={opacity} label={`${label} opacity`} />
                {settings[key] && <Control aria-label={`Reset ${label.toLowerCase()} to theme`} onClick={() => change({ [key]: null })}>Use theme color</Control>}
              </EditorToolbarPopover>
            </FieldRow>;
          })}
        </fieldset>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </div>
  </div>;
}
function NewLayout({ composition, settings, setSettings, seed, variant, setVariant, generate, blocked }) {
  const empty = !composition.cells.length, range = compositionLayoutCountRange(composition);
  const [error, setError] = useState('');
  const change = patch => { setSettings(current => ({ ...current, ...patch })); setError(''); };
  const proposal = useMemo(() => {
    try {
      // Validate the actual placement of existing content, not just empty tiles.
      const candidate = applyCompositionLayout(composition, settings, seed), area = candidate.workbench.area;
      return { cells: candidate.cells.map(cell => {
        const frame = compositionModuleWindow(candidate, cell.id);
        return { ...frame, left: frame.left - area.left, top: frame.top - area.top, radius: cell.radius };
      }) };
    } catch (failure) { return { error: failure.message }; }
  }, [composition, settings, seed]);
  return <form className="composition-bento-settings" onSubmit={event => {
    event.preventDefault(); try { generate(settings, seed); setError(''); } catch (failure) { setError(failure.message); }
  }}>
    <div className="composition-bento-scroll">
      <fieldset disabled={blocked} aria-label="New layout">
        <FieldRow label="Cells">
          <Field label="Columns" prefix="Cols" min={1} max={range.max} value={settings.columns} onChange={columns => change({ columns })} />
          <Field label="Rows" prefix="Rows" min={1} max={range.max} value={settings.rows} onChange={rows => change({ rows })} />
        </FieldRow>
        <GeometryFields {...{ settings, change }} disabled={blocked} />
        {proposal.cells && <svg className="composition-bento-preview" role="img" aria-label={`${settings.columns} columns, ${settings.rows} rows preview`} viewBox={`0 0 ${settings.width} ${settings.height}`}>
          {proposal.cells.map((r, index) => <rect key={index} x={r.left} y={r.top} width={r.width} height={r.height} rx={r.radius} />)}
        </svg>}
        <div className="composition-bento-fields">
          <Control disabled={variant === 0} onClick={() => setVariant(value => value - 1)}>Previous layout</Control>
          <Control onClick={() => setVariant(value => value + 1)}>Another layout</Control>
        </div>
      </fieldset>
      <footer className="composition-bento-footer">
        {(error || proposal.error) && <p role="alert">{error || proposal.error}</p>}
        <Control type="submit" data-primary disabled={blocked || !proposal.cells}>{empty ? 'Create Bento' : 'Replace layout'}</Control>
      </footer>
    </div>
  </form>;
}
