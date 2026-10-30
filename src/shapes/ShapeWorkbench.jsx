import { useWorkbenchMiniature } from '../public/ownerSystemWorkflow/workbenchMiniatures.js';
import CommittedColourControls from '../colour/CommittedColourControls.jsx';
import ShapeEffectsControls from './ShapeEffectsControls.jsx';
import { Copy, Trash2, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp } from 'lucide-react';
import { gridShapeFrame } from './gridShapeGeometry.js';
import { useCallback, useEffect, useMemo, useState, useId } from 'react';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { resizeWorkbenchWindow } from '../public/ownerSystemWorkflow/ownerSystemWorkflowWindowGeometry.js';
import { ContextToolContent, useContextToolTarget } from '../public/ownerSystemWorkflow/ContextToolbar.jsx';
import { useWorkbenchView, workbenchModuleTransform, useArtworkOpener, useClosedArtworkLayout, useWorkbenchToolSource } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { commitWorkbenchSelectionResize } from '../systemWorkflow/resizeWorkbenchSelection.js';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';
import { moduleGrainStyle } from '../systemWorkflow/domain/moduleSurfaceAppearance.js';
import { createShapePresentation, MAX_SHAPES } from './shapes.js';
import { addShape, editShape, reorderShape, prepareShapeResize } from './shapeSession.js';
import '../public/ownerSystemWorkflow/displayInstruments.css';
import '../public/ownerSystemWorkflow/moduleSurface.css';
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
  useArtworkOpener(record.id, () => setPresentation(current => ({ ...current, open: true })));
  const [committedFrame, setCommittedFrame] = useState(null), [failure, setFailure] = useState(null);
  const setError = useCallback((message, surface = 'actions') => setFailure(message ? { message, surface } : null), []);
  const active = useContextToolTarget() === record.id;
  const kind = record.kind || 'rectangle';
  const view = useWorkbenchView();
  const editable = Boolean(store) && !suspended && !view.presentationTransforms?.[record.id];
  useClosedArtworkLayout(presentation, setPresentation, view.content?.workbench?.shapes?.find(item => item.id === record.id));
  const layout = useCallback(window => setPresentation(current => JSON.stringify(current.window) === JSON.stringify(window) ? current : { ...current, window }), []);
  const applyFrame = useCallback(frame => { setCommittedFrame(frame); layout(frame); }, [layout]);
  const resizeTarget = useMemo(() => ({ enabled: editable, reflow: true, continuousGeometry: true,
    expected: record, store, profileAddress, layoutKey: 'shapes', commit: commitWorkbenchSelectionResize,
    prepare: prepareShapeResize, applyFrame, reportError: setError, resizeCorner: resizeWorkbenchWindow,
    minimumWidth: kind === 'grid' ? record.grid.spacing : 8, minimumHeight: kind === 'grid' ? record.grid.spacing : 8,
    maximumWidth: 7992, maximumHeight: 7992,
    groupScaleLimits: kind === 'grid' ? { minimum: 8 / record.grid.spacing, maximum: 512 / record.grid.spacing } : undefined,
    resizeStep: kind === 'grid' ? record.grid.spacing : undefined,
    constrainFrame: kind === 'grid' ? (frame, options) => gridShapeFrame(frame, record.grid.spacing, options) : undefined,
  }), [editable, record, store, profileAddress, applyFrame, kind, setError]);
  useEffect(() => { onPresentationChange?.(record.id, presentation); }, [record.id, presentation, onPresentationChange]);
  useEffect(() => () => onPresentationChange?.(record.id, null), [record.id, onPresentationChange]);
  const run = (action, surface = 'actions') => { if (!editable) return; try { action(); setError(''); } catch (failure) { setError(failure.message, surface); } };
  const change = (changes, surface = 'shape') => run(() => editShape(store, profileAddress, record, changes, view.getPresentation()), surface);
  const [colorPreview, setColorPreview] = useState(null);
  const [fxPreview, setFxPreview] = useState(null);
  const painted = useMemo(() => ({ ...record, ...(colorPreview?.record === record ? colorPreview.patch : {}), ...(fxPreview?.record === record ? fxPreview.patch : {}) }), [record, colorPreview, fxPreview]);
  useWorkbenchMiniature(record.id, useMemo(() => ({ kind: 'shape', record: painted }), [painted]));
  const select = id => { onActivate?.(id); view.setSelection?.([id]); };
  // The module owns its settings, presentation, saving and history; the dock
  // only presents this source for the current Workbench selection.
  const shapeTools = <section key={record.id} className="shape-tools" data-workbench-inspection-target={record.id} aria-label={`${record.name} Shape settings`}>
    {!editable ? <p>Shape settings are unavailable while viewing this artwork.</p> : <>
      <label>Selected shape<select aria-label="Selected shape" value={record.id} onChange={event => select(event.target.value)}>
        {[...records].reverse().map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>Name<input key={record.name} aria-label="Shape name" defaultValue={record.name} maxLength={48}
        onBlur={event => { const name = event.target.value.trim(); if (name && name !== record.name) change({ name }); }}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
      {kind === 'texture' && <PatternNumber label="Noise strength (%)" value={Math.round(record.opacity * 100)} min={0} max={100}
        onChange={opacity => change({ opacity: opacity / 100 })} />}
      {kind === 'grid' && <><label className="shape-check"><input type="checkbox" checked={record.grid.snap !== false} onChange={event => change({ grid: { ...record.grid, snap: event.target.checked } })} />Snap to this grid</label><div className="shape-tools-row">
        <PatternNumber label="Grid spacing" value={record.grid.spacing} min={8} max={512} step="any"
          onChange={spacing => change({ grid: { ...record.grid, spacing } })} />
        <PatternNumber label="Line width" value={record.grid.lineWidth} min={.25} max={4} step={.25}
          onChange={lineWidth => change({ grid: { ...record.grid, lineWidth } })} />
      </div></>}
      {kind === 'texture' && <PatternNumber label="Noise scale" value={record.texture.scale} min={.25} max={8} step={.25}
        onChange={scale => change({ texture: { scale } })} />}
      <label className="shape-check"><input type="checkbox" checked={record.visibility === 'PUBLIC'} onChange={event => change({ visibility: event.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Include in publication</label>
    </>}
    {failure?.surface === 'shape' && <p role="alert">{failure.message}</p>}
  </section>;
  useWorkbenchToolSource(record.id, { color: <>
    <CommittedColourControls color={record.color} opacity={kind === 'texture' ? undefined : record.opacity} disabled={!editable || !presentation.open}
      getVersion={() => store.getGeneration()} onChange={patch => change(patch, 'color')} onPreview={patch => setColorPreview(patch ? { record, patch } : null)} />
    {failure?.surface === 'color' && <p role="alert">{failure.message}</p>}
  </>, shape: shapeTools, fx: <section key={record.id} aria-label={`${record.name} effects`}>
    <ShapeEffectsControls record={record} store={store} disabled={!editable || !presentation.open}
      onPreview={patch => setFxPreview(patch ? { record, patch } : null)} onChange={patch => change(patch, 'fx')} />
    {failure?.surface === 'fx' && <p role="alert">{failure.message}</p>}
  </section> });
  return <>
    <div className="shape-instance" data-shape-kind={kind} data-grid-selected={kind === 'grid' && view.selection?.includes(record.id) || undefined} data-workbench-select-on-pointer={editable || undefined} data-editable={editable || undefined} data-active={active || undefined}
      onPointerDownCapture={event => editable && event.button === 0 && onActivate?.(record.id)} onFocusCapture={() => editable && onActivate?.(record.id)}>
      {presentation.open && <WorkbenchWindow label="Shape" title={record.name} className="shape-window" chrome="bevel"
        viewId={record.id} active={active} placementModule={editable} snapToGrid={editable && windowSnap} moveFromContent={editable}
        minimumWidth={8} minimumHeight={8} resizableWidth resizable={editable}
        width={presentation.window.width} initialHeight={presentation.window.height} initialX={presentation.window.left} initialY={presentation.window.top}
        onLayoutChange={layout} resizeTarget={resizeTarget} committedFrame={committedFrame}
        surfaceStyle={{ zIndex: index + 1 }}>
        <div className="shape-paint" style={{ filter: painted.blur ? `blur(calc(${painted.blur}px * var(--workbench-content-scale, 1)))` : undefined }}>
        <div className="shape-fill" data-shape-kind={kind} style={{ backgroundColor: kind === 'grid' ? 'transparent' : painted.color,
          color: painted.color, opacity: painted.opacity, ...moduleGrainStyle(painted.grain),
          ...(record.grid ? { '--shape-grid-spacing': `${record.grid.spacing}px`, '--shape-grid-line': `${record.grid.lineWidth}px` } : {}),
          ...(record.texture ? { '--shape-noise-scale': record.texture.scale } : {}) }}>
          {kind === 'grid' && <GridPaint record={record} />}
          {kind === 'rectangle' && painted.grain > 0 && <span aria-hidden="true" className="module-surface-grain" />}
        </div>
        </div>
        {kind === 'grid' && editable && <div className="shape-grid-border" aria-hidden="true">
          {['n', 'e', 's', 'w'].map(edge => <span key={edge} className={`is-${edge}`} />)}
        </div>}
      </WorkbenchWindow>}
    </div>
    {editable && <ContextToolContent target={record.id} label={record.name} actions={<nav aria-label="Shape actions" className="system-workflow__selection-actions"><button className="workflow-tactile-control" type="button" disabled={records.length >= MAX_SHAPES} onClick={() => run(() => select(addShape(store, profileAddress, { workbench: view.getPresentation() }, record)))} aria-label="Duplicate shape" title="Duplicate shape"><Copy /></button>

          {[['back', 'Send to back', ChevronsDown], ['backward', 'Move backward', ChevronDown], ['forward', 'Move forward', ChevronUp], ['front', 'Bring to front', ChevronsUp]].map(([direction, label, Icon]) =>
            <button className="workflow-tactile-control" type="button" key={direction} aria-label={label} title={label}
              onClick={() => run(() => reorderShape(store, profileAddress, record.id, direction))}><Icon /></button>)}
          <button className="workflow-tactile-control" type="button" onClick={() => run(() => {
            if (!removeWorkbenchModule(store, profileAddress, 'shape', record)) throw new Error('The shape could not be deleted. Try again.');
            onActivate?.(records.find(item => item.id !== record.id)?.id || null);
          })} aria-label="Delete shape" title="Delete shape"><Trash2 /></button></nav>}
      inspection={failure?.surface === 'actions' && <p role="alert">{failure.message}</p>} />}
  </>;
}

export default function ShapeWorkbench({ records, presentations, store, profileAddress, onPresentationChange, onActivate, suspended = false, windowSnap = false }) {
  return <div className="shape-workbench" data-workbench-module="shape">
    {records.map((record, index) => <ShapeInstance key={`${profileAddress}:${record.id}`} {...{ record, records, index, store, profileAddress, onPresentationChange, onActivate, suspended, windowSnap }}
      initialPresentation={presentations?.find(item => item.id === record.id)} />)}
  </div>;
}
