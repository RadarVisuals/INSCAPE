import { useWorkbenchMiniature } from '../public/ownerSystemWorkflow/workbenchMiniatures.js';
import CommittedColourControls from '../colour/CommittedColourControls.jsx';
import ShapeOutlineControls, { PatternNumber } from './ShapeOutlineControls.jsx';
import ShapeEffectsControls from './ShapeEffectsControls.jsx';
import { gridShapeFrame } from './gridShapeGeometry.js';
import { useCallback, useEffect, useMemo, useState, useId } from 'react';
import { EditorCellTools, useEditorCells, editorCellStructureActions } from '../reception/EditorCellsContext.jsx';
import { RECEPTION_CELL_LIMIT } from '../reception/receptionEditorDocument.js';
import ShapeSurface from './ShapeSurface.jsx';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { resizeWorkbenchWindow } from '../public/ownerSystemWorkflow/ownerSystemWorkflowWindowGeometry.js';
import { useContextToolTarget } from '../public/ownerSystemWorkflow/ContextToolbar.jsx';
import { useWorkbenchView, workbenchModuleTransform, useArtworkOpener, useClosedArtworkLayout, useWorkbenchToolSource } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { commitWorkbenchSelectionResize } from '../systemWorkflow/resizeWorkbenchSelection.js';
import { createShapePresentation, MAX_SHAPES } from './shapes.js';
import { addShape, editShape, prepareShapeResize } from './shapeSession.js';
import '../public/ownerSystemWorkflow/displayInstruments.css';
import '../public/ownerSystemWorkflow/moduleSurface.css';
import './shapes.css';

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
  const cellContext = useEditorCells();
  const cell = cellContext?.cells.find(item => item.id === record.id);
  const cellParent = cellContext?.cells.find(item => item.members.includes(record.id));
  useClosedArtworkLayout(presentation, setPresentation, view.content?.workbench?.shapes?.find(item => item.id === record.id));
  const layout = useCallback(window => setPresentation(current => JSON.stringify(current.window) === JSON.stringify(window) ? current : { ...current, window }), []);
  const applyFrame = useCallback(frame => { setCommittedFrame(frame); layout(frame); }, [layout]);
  const resizeTarget = useMemo(() => ({ enabled: editable && !cell, reflow: true, continuousGeometry: true,
    expected: record, store, profileAddress, layoutKey: 'shapes', commit: commitWorkbenchSelectionResize,
    prepare: prepareShapeResize, applyFrame, reportError: setError, resizeCorner: resizeWorkbenchWindow,
    minimumWidth: kind === 'grid' ? record.grid.spacing : 8, minimumHeight: kind === 'grid' ? record.grid.spacing : 8,
    maximumWidth: 7992, maximumHeight: 7992,
    groupScaleLimits: kind === 'grid' ? { minimum: 8 / record.grid.spacing, maximum: 512 / record.grid.spacing } : undefined,
    resizeStep: kind === 'grid' ? record.grid.spacing : undefined,
    constrainFrame: kind === 'grid' ? (frame, options) => gridShapeFrame(frame, record.grid.spacing, options) : undefined,
  }), [editable, cell, record, store, profileAddress, applyFrame, kind, setError]);
  useEffect(() => { onPresentationChange?.(record.id, presentation); }, [record.id, presentation, onPresentationChange]);
  useEffect(() => () => onPresentationChange?.(record.id, null), [record.id, onPresentationChange]);
  const run = (action, surface = 'actions') => { if (!editable) return; try { action(); setError(''); } catch (failure) { setError(failure.message, surface); } };
  const change = (changes, surface = 'shape') => run(() => editShape(store, profileAddress, record, changes, view.getPresentation()), surface);
  const [colorPreview, setColorPreview] = useState(null);
  const [colorTarget, setColorTarget] = useState('fill');
  const outline = record.outline || { width: 0, color: record.color, opacity: 1 };
  const outlineTarget = kind === 'rectangle' && colorTarget === 'outline';
  const innerLinesTarget = Boolean(cell && colorTarget === 'inner-lines');
  const colorPatch = patch => outlineTarget ? { outline: { ...outline, ...patch } } : patch;
  const [fxPreview, setFxPreview] = useState(null);
  const painted = useMemo(() => ({ ...record, ...(colorPreview?.record === record ? colorPreview.patch : {}), ...(fxPreview?.record === record ? fxPreview.patch : {}) }), [record, colorPreview, fxPreview]);
  useWorkbenchMiniature(record.id, useMemo(() => ({ kind: 'shape', record: painted, radius: cell?.radius || 0 }), [painted, cell?.radius]));
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
      <EditorCellTools record={record} view={view} run={run} />
    </>}
    {failure?.surface === 'shape' && <p role="alert">{failure.message}</p>}
  </section>;
  useWorkbenchToolSource(record.id, { actions: {
    disabled: !editable,
    duplicate: { disabled: Boolean(cell) || records.length >= MAX_SHAPES,
      reason: cell ? 'Duplicating a whole Reception cell is not available.' : records.length >= MAX_SHAPES ? 'At most 32 shapes are supported.' : undefined,
      run: () => select(addShape(store, profileAddress, { workbench: view.getPresentation() }, record)) },
    items: cellContext && kind === 'rectangle' ? cell ? [
      { id: 'edit-cell', label: 'Edit cell contents', run: () => cellContext.enterCell(record.id) },
      { id: 'cell-settings', label: 'Bento settings', run: () => cellContext.openSettings(record.id) },
      ...editorCellStructureActions(store, record.id, view),
    ] : [{ id: 'make-cell', label: 'Turn into cell', disabled: Boolean(cellParent) || cellContext.cells.length >= RECEPTION_CELL_LIMIT,
      run: () => { store.turnShapeIntoCell(record.id, view.getPresentation()); view.selectArtwork(record.id); } }] : [],
  }, color: <>
    {kind === 'rectangle' && <div className="shape-tools">
      <label>Color target<select aria-label="Color target" value={colorTarget} disabled={!editable || !presentation.open}
        onChange={event => { setColorPreview(null); setColorTarget(event.target.value); }}>
        <option value="fill">Fill</option><option value="outline">Outline</option>
        {cell && <option value="inner-lines" disabled={!cellContext.innerLines}>Bento inner lines</option>}
      </select></label>
    </div>}
    {innerLinesTarget ? cellContext.innerLines ? <ShapeOutlineControls key="inner-lines" outline={cellContext.innerLines}
      disabled={!editable || !presentation.open} scopeKey={`${profileAddress}:${record.id}:inner-lines`}
      getVersion={() => store.getGeneration()} onChange={patch => run(() => cellContext.changeInnerLines(patch), 'color')}
      onPreview={cellContext.previewInnerLines} /> : <p>Enable inner lines in Bento settings.</p>
      : outlineTarget ? <ShapeOutlineControls key="outline" outline={outline} disabled={!editable || !presentation.open}
        scopeKey={`${profileAddress}:${record.id}:outline`} getVersion={() => store.getGeneration()}
        onChange={patch => change(colorPatch(patch), 'color')} onPreview={patch => setColorPreview(patch ? { record, patch: colorPatch(patch) } : null)} />
      : <CommittedColourControls key="fill" color={record.color}
      opacity={kind === 'texture' ? undefined : record.opacity} disabled={!editable || !presentation.open}
      scopeKey={`${profileAddress}:${record.id}:${colorTarget}`}
      getVersion={() => store.getGeneration()} onChange={patch => change(colorPatch(patch), 'color')}
      onPreview={patch => setColorPreview(patch ? { record, patch: colorPatch(patch) } : null)} />}
    {failure?.surface === 'color' && <p role="alert">{failure.message}</p>}
  </>, shape: shapeTools, fx: <section key={record.id} aria-label={`${record.name} effects`}>
    <ShapeEffectsControls record={record} store={store} disabled={!editable || !presentation.open}
      onPreview={patch => setFxPreview(patch ? { record, patch } : null)} onChange={patch => change(patch, 'fx')} />
    {failure?.surface === 'fx' && <p role="alert">{failure.message}</p>}
  </section> });
  return <>
    <div className="shape-instance" data-shape-kind={kind} data-cell-owner={cell ? record.id : undefined} data-grid-selected={kind === 'grid' && view.selection?.includes(record.id) || undefined} data-workbench-select-on-pointer={editable || undefined} data-editable={editable || undefined} data-active={active || undefined}
      onPointerDownCapture={event => editable && event.button === 0 && onActivate?.(record.id)} onFocusCapture={() => editable && onActivate?.(record.id)}>
      {presentation.open && <WorkbenchWindow label="Shape" title={record.name} className="shape-window" chrome="bevel"
        viewId={record.id} active={active} placementModule={editable && !cell} snapToGrid={editable && !cell && windowSnap} moveFromContent={editable && !cell}
        minimumWidth={8} minimumHeight={8} resizableWidth resizable={editable && !cell}
        width={presentation.window.width} initialHeight={presentation.window.height} initialX={presentation.window.left} initialY={presentation.window.top}
        onLayoutChange={layout} resizeTarget={resizeTarget} committedFrame={committedFrame}
        surfaceStyle={{ zIndex: index + 1 }}>
        <ShapeSurface record={painted} radius={cell?.radius || 0} hideOutline={Boolean(cell && cellContext.innerLines)}>{kind === 'grid' && <GridPaint record={record} />}</ShapeSurface>
        {cell?.content && <span className="editor-cell-content-note">{cell.content.startsWith('link:') ? 'Linked canvas content' : 'Profile content'} · visible in Preview</span>}
        {kind === 'grid' && editable && <div className="shape-grid-border" aria-hidden="true">
          {['n', 'e', 's', 'w'].map(edge => <span key={edge} className={`is-${edge}`} />)}
        </div>}
      </WorkbenchWindow>}
    </div>
  </>;
}

export default function ShapeWorkbench({ records, presentations, store, profileAddress, onPresentationChange, onActivate, suspended = false, windowSnap = false }) {
  return <div className="shape-workbench" data-workbench-module="shape">
    {records.map((record, index) => <ShapeInstance key={`${profileAddress}:${record.id}`} {...{ record, records, index, store, profileAddress, onPresentationChange, onActivate, suspended, windowSnap }}
      initialPresentation={presentations?.find(item => item.id === record.id)} />)}
  </div>;
}
