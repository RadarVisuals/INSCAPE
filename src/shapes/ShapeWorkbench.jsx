import { Copy, Trash2, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp } from 'lucide-react';
import { gridShapeFrame } from './gridShapeGeometry.js';
import { useCallback, useEffect, useMemo, useState, useId } from 'react';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { ContextToolContent, useContextToolTarget } from '../public/ownerSystemWorkflow/ContextToolbar.jsx';
import { useWorkbenchView, workbenchModuleTransform } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { commitWorkbenchSelectionResize } from '../systemWorkflow/resizeWorkbenchSelection.js';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';
import { ModuleGrainControl } from '../public/ownerSystemWorkflow/ModuleSurfaceControls.jsx';
import { moduleGrainStyle } from '../systemWorkflow/domain/moduleSurfaceAppearance.js';
import { createShapePresentation, MAX_SHAPES } from './shapes.js';
import { addShape, editShape, reorderShape, prepareShapeResize } from './shapeSession.js';
import '../public/ownerSystemWorkflow/displayInstruments.css';
import './shapes.css';

function PatternNumber({ label, value, min, max, step = 1, onChange }) {
  return <label>{label}<input key={value} aria-label={label} type="number" min={min} max={max} step={step} defaultValue={value}
    onBlur={event => {
      if (event.target.value === '' || !event.target.validity.valid) { event.target.value = value; return; }
      const next = Number(event.target.value); if (next !== value) onChange(next);
    }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>;
}

function GridPaint({ record }) {
  const id = useId().replace(/:/g, '');
  const view = useWorkbenchView();
  const scale = workbenchModuleTransform(view, record.id).scale * (globalThis.devicePixelRatio || 1);
  const spacing = record.grid.spacing * scale * (view.transforms?.[record.id]?.gridScale || 1), line = Math.max(1, record.grid.lineWidth * scale);
  return <svg className="shape-grid-paint" aria-hidden="true" width="100%" height="100%">
    <defs><pattern id={id} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
      <path d={`M0,${spacing}V0H${spacing}`} fill="none" stroke="currentColor" strokeWidth={line * 2} />
    </pattern></defs><rect width="100%" height="100%" fill={`url(#${id})`} />
    <rect width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth={line * 2} />
  </svg>;
}

function ShapeInstance({ record, records, index, initialPresentation, store, profileAddress, onPresentationChange, onActivate, suspended, windowSnap }) {
  const [presentation, setPresentation] = useState(() => initialPresentation || createShapePresentation(record.id, index));
  const [committedFrame, setCommittedFrame] = useState(null), [error, setError] = useState('');
  const active = useContextToolTarget() === record.id;
  const kind = record.kind || 'rectangle';
  const view = useWorkbenchView();
  const editable = Boolean(store) && !suspended && !view.presentationTransforms?.[record.id];
  const layout = useCallback(window => setPresentation(current => JSON.stringify(current.window) === JSON.stringify(window) ? current : { ...current, window }), []);
  const applyFrame = useCallback(frame => { setCommittedFrame(frame); layout(frame); }, [layout]);
  const resizeTarget = useMemo(() => ({ enabled: editable, reflow: true, continuousGeometry: true,
    expected: record, store, profileAddress, layoutKey: 'shapes', commit: commitWorkbenchSelectionResize,
    prepare: prepareShapeResize, applyFrame, reportError: setError,
    minimumWidth: kind === 'grid' ? record.grid.spacing : 8, minimumHeight: kind === 'grid' ? record.grid.spacing : 8,
    maximumWidth: 7992, maximumHeight: 7992,
    resizeStep: kind === 'grid' ? record.grid.spacing : undefined,
    constrainFrame: kind === 'grid' ? (frame, options) => gridShapeFrame(frame, record.grid.spacing, options) : undefined,
  }), [editable, record, store, profileAddress, applyFrame]);
  useEffect(() => { onPresentationChange?.(record.id, presentation); }, [record.id, presentation, onPresentationChange]);
  useEffect(() => () => onPresentationChange?.(record.id, null), [record.id, onPresentationChange]);
  const run = action => { if (!editable) return; try { action(); setError(''); } catch (failure) { setError(failure.message); } };
  const change = changes => run(() => editShape(store, profileAddress, record, changes, view.getPresentation()));
  const select = id => { onActivate?.(id); view.setSelection?.([id]); };
  const resize = (width, height) => {
    if (![width, height].every(value => Number.isFinite(value) && value >= 8 && value <= 7992)) { setError('Choose dimensions from 8 to 7992 pixels.'); return; }
    const frame = view.getPresentation()?.shapes?.find(item => item.id === record.id)?.window || presentation.window;
    const next = resizeTarget.constrainFrame?.({ ...frame, width, height }) || { ...frame, width, height };
    if (commitWorkbenchSelectionResize([{ ...resizeTarget, id: record.id, ...next, getPresentation: view.getPresentation }])) {
      view.setTransforms(values => { const next = { ...values }; delete next[record.id]; return next; });
      applyFrame(next);
    }
  };
  return <>
    <div className="shape-instance" data-shape-kind={kind} data-grid-selected={kind === 'grid' && view.selection?.includes(record.id) || undefined} data-workbench-select-on-pointer={editable || undefined} data-editable={editable || undefined} data-active={active || undefined}
      onPointerDownCapture={event => editable && event.button === 0 && onActivate?.(record.id)} onFocusCapture={() => editable && onActivate?.(record.id)}>
      {presentation.open && <WorkbenchWindow label="Shape" title={record.name} className="shape-window" chrome="bevel"
        viewId={record.id} active={active} placementModule={editable} snapToGrid={editable && windowSnap} moveFromContent={editable}
        minimumWidth={8} minimumHeight={8} resizableWidth resizable={editable}
        width={presentation.window.width} initialHeight={presentation.window.height} initialX={presentation.window.left} initialY={presentation.window.top}
        onLayoutChange={layout} resizeTarget={resizeTarget} committedFrame={committedFrame}
        surfaceStyle={{ zIndex: index + 1 }}>
        <div className="shape-fill" data-shape-kind={kind} style={{ backgroundColor: kind === 'grid' ? 'transparent' : record.color,
          color: record.color, opacity: record.opacity, ...moduleGrainStyle(record.grain),
          ...(record.grid ? { '--shape-grid-spacing': `${record.grid.spacing}px`, '--shape-grid-line': `${record.grid.lineWidth}px` } : {}),
          ...(record.texture ? { '--shape-noise-scale': record.texture.scale } : {}) }}>
          {kind === 'grid' && <GridPaint record={record} />}
          {kind === 'rectangle' && record.grain > 0 && <span aria-hidden="true" className="module-surface-grain" />}
        </div>
        {kind === 'grid' && editable && <div className="shape-grid-border" aria-hidden="true">
          {['n', 'e', 's', 'w'].map(edge => <span key={edge} className={`is-${edge}`} />)}
        </div>}
      </WorkbenchWindow>}
    </div>
    {editable && <ContextToolContent target={record.id} label={record.name} actions={<nav aria-label="Shape actions" className="system-workflow__selection-actions"><button className="workflow-tactile-control" type="button" disabled={records.length >= MAX_SHAPES} onClick={() => run(() => select(addShape(store, profileAddress, { workbench: view.getPresentation() }, record)))} aria-label="Duplicate shape" title="Duplicate shape"><Copy /></button>

          {[['back', 'Send to back', ChevronsDown], ['backward', 'Move backward', ChevronDown], ['forward', 'Move forward', ChevronUp], ['front', 'Bring to front', ChevronsUp]].map(([direction, label, Icon]) =>
            <button className="workflow-tactile-control" type="button" key={direction} aria-label={label} title={label} disabled={['back', 'backward'].includes(direction) ? index === 0 : index === records.length - 1}
              onClick={() => run(() => reorderShape(store, profileAddress, record.id, direction))}><Icon /></button>)}
          <button className="workflow-tactile-control" type="button" onClick={() => run(() => {
            if (!removeWorkbenchModule(store, profileAddress, 'shape', record)) throw new Error('The shape could not be deleted. Try again.');
            onActivate?.(records.find(item => item.id !== record.id)?.id || null);
          })} aria-label="Delete shape" title="Delete shape"><Trash2 /></button></nav>}>
      <div className="shape-tools">


        <label>Shape<select aria-label="Choose shape" value={record.id} onChange={event => select(event.target.value)}>
          {[...records].reverse().map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label>Name<input key={record.name} aria-label="Shape name" defaultValue={record.name} maxLength={48}
          onBlur={event => { const name = event.target.value.trim(); if (name && name !== record.name) change({ name }); }}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
        <div className="shape-tools-row">
          <label>Colour<input type="color" aria-label="Shape colour" value={record.color} onChange={event => change({ color: event.target.value })} /></label>
          <label>{kind === 'texture' ? 'Noise strength (%)' : 'Opacity (%)'}<input key={record.opacity} type="number" min="0" max="100" aria-label={kind === 'texture' ? 'Noise strength' : 'Shape opacity'} defaultValue={Math.round(record.opacity * 100)}
            onBlur={event => { if (event.target.value !== '' && event.target.validity.valid) change({ opacity: Number(event.target.value) / 100 }); }}
            onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
        </div>
        {kind === 'rectangle' && <ModuleGrainControl value={record.grain} onChange={grain => change({ grain })} />}
        {kind === 'grid' && <><label className="shape-check"><input type="checkbox" checked={record.grid.snap !== false} onChange={event => change({ grid: { ...record.grid, snap: event.target.checked } })} />Snap to this grid</label><div className="shape-tools-row">
          <PatternNumber label="Grid spacing" value={record.grid.spacing} min={8} max={512} step="any"
            onChange={spacing => change({ grid: { ...record.grid, spacing } })} />
          <PatternNumber label="Line width" value={record.grid.lineWidth} min={.25} max={4} step={.25}
            onChange={lineWidth => change({ grid: { ...record.grid, lineWidth } })} />
        </div></>}
        {kind === 'texture' && <PatternNumber label="Noise scale" value={record.texture.scale} min={.25} max={8} step={.25}
          onChange={scale => change({ texture: { scale } })} />}
        <details className="workbench-dimensions"><summary>Dimensions…</summary>
        <form key={`${presentation.window.width}:${presentation.window.height}`} onSubmit={event => {
          event.preventDefault(); const values = new FormData(event.currentTarget); resize(Number(values.get('width')), Number(values.get('height')));
        }}>
          <div className="shape-tools-row">
            <label>Width<input aria-label="Shape width" name="width" type="number" min="8" max="7992" step="any" required defaultValue={presentation.window.width} /></label>
            <label>Height<input aria-label="Shape height" name="height" type="number" min="8" max="7992" step="any" required defaultValue={presentation.window.height} /></label>
          </div>
          <div className="shape-tools-row"><button className="workflow-tactile-control" type="submit">Apply size</button><button className="workflow-tactile-control" type="button" onClick={() => resize(presentation.window.width, presentation.window.width)}>Make square</button></div>
        </form></details>
        <label className="shape-check"><input type="checkbox" checked={presentation.open} onChange={event => setPresentation(p => ({ ...p, open: event.target.checked }))} />Show shape</label>
        <label className="shape-check"><input type="checkbox" checked={record.visibility === 'PUBLIC'} onChange={event => change({ visibility: event.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Include in publication</label>
        {error && <p role="alert">{error}</p>}
      </div>
    </ContextToolContent>}
  </>;
}

export default function ShapeWorkbench({ records, presentations, store, profileAddress, onPresentationChange, onActivate, suspended = false, windowSnap = false }) {
  return <div className="shape-workbench" data-workbench-module="shape">
    {records.map((record, index) => <ShapeInstance key={`${profileAddress}:${record.id}`} {...{ record, records, index, store, profileAddress, onPresentationChange, onActivate, suspended, windowSnap }}
      initialPresentation={presentations?.find(item => item.id === record.id)} />)}
  </div>;
}
