import { useWorkbenchMiniature } from '../public/ownerSystemWorkflow/workbenchMiniatures.js';
import InspectorColourControls from '../colour/InspectorColourControls.jsx';
import { CommittedOpacityControl } from '../colour/CommittedColourControls.jsx';
import ShapeFillButton from './ShapeFillButton.jsx';
import EditorCellInspector from '../reception/EditorCellInspector.jsx';
import { OwnerSystemWorkflowSelectMenu } from '../public/ownerSystemWorkflow/OwnerSystemWorkflowWorkspaceControls.jsx';
import ShapeOutlineControls, { PatternNumber } from './ShapeOutlineControls.jsx';
import ShapeEffectsControls from './ShapeEffectsControls.jsx';
import { gridShapeFrame } from './gridShapeGeometry.js';
import { useCallback, useEffect, useMemo, useState, useId } from 'react';
import { GripVertical } from 'lucide-react';
import { EditorCellTools, useEditorCells, editorCellStructureActions } from '../reception/EditorCellsContext.jsx';
import { RECEPTION_CELL_LIMIT } from '../reception/receptionEditorDocument.js';
import ShapeSurface from './ShapeSurface.jsx';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { resizeWorkbenchWindow } from '../public/ownerSystemWorkflow/ownerSystemWorkflowWindowGeometry.js';
import { useContextToolTarget } from '../public/ownerSystemWorkflow/ContextToolbar.jsx';
import { useWorkbenchArea } from '../public/ownerSystemWorkflow/WorkbenchAreaContext.jsx';
import { SharedDisplayToolContent } from '../public/ownerSystemWorkflow/SharedDisplayTools.jsx';
import { ArtworkInfoButton, LayerNameInput } from '../public/ownerSystemWorkflow/ArtworkToolbarControls.jsx';
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
  const { canvasHost } = useWorkbenchArea();
  const cellContext = useEditorCells();
  const cell = cellContext?.cells.find(item => item.id === record.id);
  const toolbarVisible = active && editable && !cell && !view.presented && view.interactionTool === 'select';
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
  const outline = record.outline || { width: 0, color: record.color, opacity: 1 };
  const [fxPreview, setFxPreview] = useState(null);
  const painted = useMemo(() => ({ ...record, ...(colorPreview?.record === record ? colorPreview.patch : {}), ...(fxPreview?.record === record ? fxPreview.patch : {}) }), [record, colorPreview, fxPreview]);
  useWorkbenchMiniature(record.id, useMemo(() => ({ kind: 'shape', record: painted, radius: cell?.radius || 0 }), [painted, cell?.radius]));
  const select = id => { onActivate?.(id); view.setSelection?.([id]); };
  // The module owns its settings, presentation, saving and history; the dock
  // only presents this source for the current Workbench selection.
  const disabled = !editable || !presentation.open;
  const fill = { color: painted.color, disabled, scopeKey: `${profileAddress}:${record.id}:fill`, getVersion: () => store.getGeneration(),
    onChange: patch => change(patch, 'color'), onPreview: patch => setColorPreview(patch ? { record, patch } : null) };
  const opacity = <CommittedOpacityControl {...fill} opacity={painted.opacity} label={kind === 'texture' ? 'Noise strength' : 'Fill opacity'}
    caption={kind === 'texture' ? 'Strength' : 'Opacity'} />;
  const fillButton = <ShapeFillButton fill={fill} opacity={painted.opacity} title={cell ? 'Cell fill' : kind === 'grid' ? 'Grid' : kind === 'texture' ? 'Texture' : 'Fill'}
    error={failure?.surface === 'color' && failure.message}>{opacity}</ShapeFillButton>;
  const shapeTools = !cell && <section key={record.id} className="shape-inspector-properties" data-workbench-inspection-target={record.id} aria-label={`${record.name} Shape settings`}>
    {!editable ? <p>Shape settings are unavailable while viewing this artwork.</p> : <>
      <div className="workbench-inspector-row"><span>Shape</span><OwnerSystemWorkflowSelectMenu flat compact palette="editor" className="workflow-tactile-control"
        label="Selected shape" value={record.id} onChange={select} options={[...records].reverse().map(item => ({ value: item.id, label: `${item.name} · ${item.kind === 'grid' ? 'Grid' : item.kind === 'texture' ? 'Texture' : 'Rectangle'}` }))} /></div>
      <div className="workbench-inspector-row"><span>Name</span><LayerNameInput label="Shape name" name={record.name} disabled={disabled} onRename={name => change({ name })} /></div>
      {kind === 'texture' && <>{opacity}
        <PatternNumber label="Noise scale" caption="Scale" value={record.texture.scale} min={.25} max={8} step={.25} disabled={disabled}
          onChange={scale => change({ texture: { scale } })} /></>}
      {kind === 'grid' && <>
        <PatternNumber label="Grid spacing" caption="Spacing" prefix="px" value={record.grid.spacing} min={8} max={512} step="any" disabled={disabled}
          onChange={spacing => change({ grid: { ...record.grid, spacing } })} />
        <PatternNumber label="Line width" prefix="px" value={record.grid.lineWidth} min={.25} max={4} step={.25} disabled={disabled}
          onChange={lineWidth => change({ grid: { ...record.grid, lineWidth } })} />
        <label className="workbench-inspector-check"><input type="checkbox" checked={record.grid.snap !== false} disabled={disabled}
          onChange={event => change({ grid: { ...record.grid, snap: event.target.checked } })} />Snap to this grid</label>
      </>}
      <EditorCellTools record={record} view={view} run={run} />
    </>}
    {failure?.surface === 'shape' && <p role="alert">{failure.message}</p>}
  </section>;
  const effects = <section key={record.id} aria-label={`${record.name} effects`}>
    <ShapeEffectsControls record={record} store={store} disabled={!editable || !presentation.open}
      onPreview={patch => setFxPreview(patch ? { record, patch } : null)} onChange={patch => change(patch, 'fx')} />
    {failure?.surface === 'fx' && <p role="alert">{failure.message}</p>}
  </section>;
  const appearance = <>
    <InspectorColourControls label="Fill" {...fill} />
    {kind !== 'texture' && opacity}
    {kind === 'rectangle' && <ShapeOutlineControls outline={outline} disabled={disabled || Boolean(cell && cellContext.innerLines)}
      scopeKey={`${profileAddress}:${record.id}:outline`} getVersion={() => store.getGeneration()} onChange={patch => change({ outline: { ...outline, ...patch } }, 'color')}
      onPreview={patch => setColorPreview(patch ? { record, patch: { outline: { ...outline, ...patch } } } : null)} />}
    {cell && cellContext.innerLines && <p className="workbench-inspector-muted">Shared inner lines replace this outline.</p>}
    {(failure?.surface === 'color' || cell && failure?.surface === 'shape') && <p role="alert">{failure.message}</p>}
  </>;
  useWorkbenchToolSource(record.id, { cellFill: cell ? fillButton : undefined, cell: cell ? tools => <EditorCellInspector key={record.id} {...tools} record={record} change={change}
    disabled={disabled} appearance={appearance} effects={effects}
    innerLines={cellContext.innerLines && <ShapeOutlineControls label="Inner lines" outline={cellContext.innerLines} disabled={disabled}
      scopeKey={`${profileAddress}:${record.id}:inner-lines`} getVersion={() => store.getGeneration()}
      onChange={patch => run(() => cellContext.changeInnerLines(patch), 'color')} onPreview={cellContext.previewInnerLines} />} /> : undefined, actions: {
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
  }, shape: cell ? undefined : ({ section, transform, position, information }) => <>
    {shapeTools}
    {section('Color', appearance, 'Appearance', true)}
    {section('FX', effects, 'Effects', true)}
    {position}{transform}
    <label className="workbench-inspector-check"><input type="checkbox" checked={record.visibility === 'PUBLIC'} disabled={disabled}
      onChange={event => change({ visibility: event.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Include in publication</label>
    {information}
  </> });
  return <>
    {store && !cell && <SharedDisplayToolContent id="metadata" targetId={record.id} label={record.name}
      available={!disabled && view.selection?.length === 1 && view.selection[0] === record.id}>
      <article className="artwork-info" aria-label="Shape information"><header><h3>{record.name}</h3><p>Inscape shape</p></header>
        <dl><div><dt>Type</dt><dd>{{ rectangle: 'Rectangle', grid: 'Grid', texture: 'Texture' }[kind]}</dd></div>
          <div><dt>Size</dt><dd>{Math.round(presentation.window.width)} × {Math.round(presentation.window.height)} px</dd></div></dl>
      </article>
    </SharedDisplayToolContent>}
    <div className="shape-instance" data-shape-kind={kind} data-cell-owner={cell ? record.id : undefined} data-grid-selected={kind === 'grid' && view.selection?.includes(record.id) || undefined} data-workbench-select-on-pointer={editable || undefined} data-editable={editable || undefined} data-active={active || undefined}
      onPointerDownCapture={event => editable && event.button === 0 && onActivate?.(record.id)} onFocusCapture={() => editable && onActivate?.(record.id)}>
      {presentation.open && <WorkbenchWindow label="Shape" title={record.name} className="shape-window" chrome="bevel"
        objectToolbar={toolbarVisible} externalControls={toolbarVisible} cssPixelSurface={Boolean(cell)} subpixelEdges={Boolean(cell && cellContext.store.getReception().bento?.gap > 0)}
        externalControlsHost={toolbarVisible ? canvasHost?.parentElement : null}
        titleContent={toolbarVisible ? <span className="editor-object-toolbar-label" title="Drag to move this shape"><GripVertical aria-hidden="true" /></span> : undefined}
        controls={toolbarVisible ? <>
          <LayerNameInput compact label="Shape layer name" name={record.name} onRename={name => change({ name }, 'actions')} />
          {fillButton}
          <ArtworkInfoButton targetId={record.id} />
          {failure?.surface === 'actions' && <span role="alert">{failure.message}</span>}
        </> : undefined}
        viewId={record.id} active={active} placementModule={editable && !cell} snapToGrid={editable && !cell && windowSnap} moveFromContent={editable && !cell}
        minimumWidth={8} minimumHeight={8} resizableWidth resizable={editable && !cell}
        width={presentation.window.width} initialHeight={presentation.window.height} initialX={presentation.window.left} initialY={presentation.window.top}
        onLayoutChange={layout} resizeTarget={resizeTarget} committedFrame={committedFrame}
        surfaceStyle={{ zIndex: index + 1 }}>
        <ShapeSurface record={painted} continuousFill={Boolean(cell && cellContext.store.getReception().bento?.gap > 0)} radius={cell?.radius || 0} hideOutline={Boolean(cell && cellContext.innerLines)}>{kind === 'grid' && <GridPaint record={record} />}</ShapeSurface>
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
