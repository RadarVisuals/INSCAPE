import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Image, Type, CornerDownRight, Grid2X2 } from 'lucide-react';
import { useWorkbenchView } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { useWorkbenchCamera } from '../public/ownerSystemWorkflow/WorkbenchCamera.jsx';
import { useWorkbenchArea } from '../public/ownerSystemWorkflow/WorkbenchAreaContext.jsx';
import { addImageModule } from '../imageModule/imageModuleSession.js';
import { resolveImageLibraryArtwork } from '../imageModule/imageLibraryArtwork.js';
import { addTextModule } from '../text/textSession.js';
import { interfaceTheme } from '../interfaceTheme.js';
import { receptionTextDefaults } from './receptionTextDefaults.js';
import { createWorkbenchGestures } from '../public/ownerSystemWorkflow/workbenchGestures.js';
import { useEditorCells } from './EditorCellsContext.jsx';
import { CellPositionButton } from './EditorCellPositionControls.jsx';
import { receptionModuleWindow, receptionModuleSizeReason } from './receptionEditorDocument.js';
import { receptionBentoSettings, resizeReceptionBentoFrame, setReceptionBentoSettings } from './receptionBento.js';
import { receptionBentoKeyboardTarget } from './receptionBentoInsertion.js';
import { createReceptionCellGesture } from './receptionCellGesture.js';
import { createReceptionCellDrawGesture } from './receptionCellDrawing.js';
import { createReceptionNeighbourMotion } from './receptionNeighbourMotion.js';
import { isWorkbenchHandSurface } from '../public/ownerSystemWorkflow/useWorkbenchPan.js';
import { WorkbenchSnapGuideOverlay } from '../public/ownerSystemWorkflow/WorkbenchSnapGuides.jsx';
import { receptionLayoutCountRange } from './receptionLayoutGenerator.js';
import ReceptionBentoPanel from './ReceptionBentoPanel.jsx';
import ReceptionInnerLines from './ReceptionInnerLines.jsx';
import ReceptionCellGrain from './ReceptionCellGrain.jsx';
import './receptionBento.css';

const LibraryPicker = lazy(() => import('../library/ProfileLibraryPicker.jsx'));
const BENTO_RESIZE_OUTSET = 12; // Screen pixels; never part of saved Bento geometry.
function CellFillAction({ id }) {
  const view = useWorkbenchView();
  useSyncExternalStore(view.subscribeTools, view.toolsSnapshot);
  return view.toolSources.get(id)?.current.cellFill ?? null;
}

export default function ReceptionBentoEditor(props) {
  const context = useEditorCells();
  return context ? <BentoEditor key={context.store.getProfileAddress()} context={context} {...props} /> : null;
}
function BentoEditor({ context, hostRef, disabled, navigation, flushLayout, library, libraryPreferences }) {
  const view = useWorkbenchView(), camera = useWorkbenchCamera(), store = context.store;
  const reception = store.getReception(), gestureHost = useRef(null), live = useRef(null), imageRequest = useRef(null);
  const { area, setPreview: setAreaPreview } = useWorkbenchArea();
  const [dragging, setDragging] = useState(null), [error, setError] = useState(''), [imageCell, setImageCell] = useState(null);
  const imageTarget = useRef(null), preview = useRef(null);
  const [previewing, setPreviewing] = useState(false), [drawingFrame, setDrawingFrame] = useState(null);
  const snapHost = useRef(null), [snapGuides, setSnapGuides] = useState([]);
  const selectedId = view.selection.length === 1 ? view.selection[0] : null;
  const [neighbourMotion] = useState(createReceptionNeighbourMotion);
  useLayoutEffect(() => { neighbourMotion.paint(); }, [neighbourMotion, view.transforms]);
  useEffect(() => () => neighbourMotion.dispose(), [neighbourMotion]);
  live.current = { view, context, disabled, flushLayout };
  const [gestures] = useState(() => createWorkbenchGestures({
    getHost: () => gestureHost.current,
    restoreTransforms: transforms => live.current.view.setTransforms(transforms),
  }));
  const cancelPreview = useCallback(() => {
    if (!preview.current) return;
    const { previous } = preview.current; preview.current = null;
    live.current.view.setTransforms(previous); setAreaPreview(null); setPreviewing(false);
  }, [setAreaPreview]);
  const previewSettings = useCallback(settings => {
    if (!store.isCurrent() || !store.hasWriteAccess() || live.current.disabled) return;
    if (!preview.current && !live.current.flushLayout()) throw new Error('Save the current edit before previewing the bento.');
    const origin = store.getReception(), next = setReceptionBentoSettings(origin, settings);
    if (!preview.current) preview.current = { previous: live.current.view.transforms, generation: store.getGeneration() };
    preview.current.next = next;
    setAreaPreview(next.workbench.area);
    live.current.view.setTransforms({ ...preview.current.previous, ...Object.fromEntries(origin.cells.map(cell => [cell.id,
      { scale: 1, x: 0, y: 0, frame: receptionModuleWindow(next, cell.id), cellMoveContents: true, cellRadius: next.cells.find(item => item.id === cell.id).radius }])) });
    setPreviewing(true);
  }, [store, setAreaPreview]);
  const flush = () => { if (!flushLayout()) throw new Error('Save the current edit before changing the bento.'); };
  const run = (action, args) => {
    cancelPreview(); flush(); store.editBento(action, args, store.getGeneration());
  };
  const perform = action => { try { action(); setError(''); } catch (failure) { setError(failure.message); } };
  const cancel = useCallback(() => gestures.cancel(), [gestures]);
  useEffect(() => {
    const blur = cancelPreview, visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    const unsubscribe = store.subscribe(() => {
      if (gestures.isActive()) cancel();
      if (preview.current?.generation !== store.getGeneration()) cancelPreview();
    });
    const unguard = store.guardWorkbenchTransition(() => { cancelPreview(); return gestures.isActive() ? 'Finish or cancel the bento gesture before leaving Studio.' : null; });
    return () => { cancel(); cancelPreview(); imageRequest.current = null; unsubscribe(); unguard(); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); };
  }, [store, cancelPreview, gestures, cancel]);
  useEffect(() => { if (disabled) { cancel(); cancelPreview(); imageRequest.current = null; setImageCell(null); } }, [disabled, cancelPreview, cancel]);
  const start = (event, cellId, edge) => {
    if (event.button !== 0 || disabled || camera.locked || gestures.isActive() || preview.current) return;
    event.preventDefault(); event.stopPropagation();
    perform(() => {
      flush();
      const origin = store.getReception(), generation = store.getGeneration();
      const { scale, offset } = camera.getCamera(), target = event.currentTarget, previous = view.transforms;
      const drawing = edge === 'draw';
      if (drawing) cellId = 'shape:' + crypto.randomUUID();
      const cellGesture = drawing ? createReceptionCellDrawGesture(origin, cellId,
        { x: (event.clientX - offset.x) / scale, y: (event.clientY - offset.y) / scale }, scale, selectedId)
        : cellId && createReceptionCellGesture(origin, cellId, edge, scale);
      let moved = false, accepted = false, unlock, proposal;
      if (cellId) { context.leaveCell(false); if (!drawing) view.selectArtwork(cellId); setDragging({ id: cellId }); }
      target.focus({ preventScroll: true }); gestureHost.current = target;
      const started = gestures.beginResize(event, {
        beforeTransforms: previous,
        valid: () => target.isConnected && store.isCurrent() && store.hasWriteAccess()
          && store.getGeneration() === generation && !live.current.disabled,
        preview: (delta, bypass, push) => {
          try {
            if (cellGesture) proposal = cellGesture(delta, bypass, push);
            else {
              moved ||= Math.hypot(delta.x, delta.y) > 4;
              if (!moved) return;
              const args = [edge, delta.x / scale, delta.y / scale];
              proposal = { action: 'resizeFrame', args, next: resizeReceptionBentoFrame(origin, ...args), guides: [] };
            }
            if (!proposal) {
              if (drawing) { setDrawingFrame(null); setSnapGuides([]); setAreaPreview(null); view.setTransforms(previous); }
              return;
            }
            const { next, guides } = proposal;
            const neighbourIds = origin.cells.filter(cell => {
              if (cell.id === cellId) return false;
              const before = live.current.view.transforms[cell.id]?.frame || receptionModuleWindow(origin, cell.id);
              const after = receptionModuleWindow(next, cell.id);
              return before.left !== after.left || before.top !== after.top;
            }).flatMap(cell => [cell.id, ...cell.members]);
            const neighbourSet = new Set(neighbourIds);
            const overlays = [...(snapHost.current?.querySelectorAll('[data-editor-cell-surface]') || [])]
              .filter(node => neighbourSet.has(node.dataset.editorCellSurface));
            neighbourMotion.capture([...neighbourIds.map(id => view.entries.get(id)), ...overlays], matchMedia('(prefers-reduced-motion: reduce)').matches);
            if (drawing) setDrawingFrame({ frame: receptionModuleWindow(next, cellId), radius: next.cells.find(c => c.id === cellId).radius });
            const screenRect = r => r && ({ ...r, left: r.left + offset.x, top: r.top + offset.y });
            setSnapGuides(guides.map(m => ({ ...m, rect: screenRect(m.rect), target: screenRect(m.target),
              value: m.value + offset[m.axis], targetEdge: m.targetEdge + offset[m.axis] })));
            setAreaPreview(next.workbench.area);
            view.setTransforms({ ...previous, ...Object.fromEntries(origin.cells.map(cell => [cell.id,
              { scale: 1, x: 0, y: 0, frame: receptionModuleWindow(next, cell.id), cellMoveContents: true }])) });
            setError('');
          } catch (failure) { setError(failure.message); gestures.cancel(); }
        },
        commit: () => {
          view.setTransforms(previous);
          if (!proposal) return true;
          try {
            store.editBento(proposal.action, proposal.args, generation);
            accepted = true;
            if (drawing) { view.selectArtwork(cellId); view.setInteractionTool('select'); }
            setError(''); return true;
          }
          catch (failure) { setError(failure.message); return false; }
        },
        onFinish: () => { if (!accepted) neighbourMotion.dispose(); unlock?.(); setDragging(null); setAreaPreview(null); setSnapGuides([]); setDrawingFrame(null); },
      });
      if (started) unlock = camera.lock(); else setDragging(null);
    });
  };
  live.current.start = start;
  useEffect(() => { cancel(); }, [view.interactionTool, cancel]);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const down = event => {
      if (live.current.view.interactionTool !== 'cell' || event.isPrimary === false || event.ctrlKey || event.metaKey
        || host.hasAttribute('data-workbench-pan-ready') || !isWorkbenchHandSurface(event.target, host)) return;
      live.current.start(event, null, 'draw');
    };
    host.addEventListener('pointerdown', down, true);
    return () => host.removeEventListener('pointerdown', down, true);
  }, [hostRef]);
  const cellStore = cellId => ({ ...store, commitCompletedOperation: (candidate, options) => store.commitInCell(cellId, candidate, options) });
  const addText = cellId => perform(() => {
    flush(); const r = receptionModuleWindow(store.getReception(), cellId);
    const id = addTextModule(cellStore(cellId), view.profileAddress, { window: r, cellId },
      receptionTextDefaults(store.getReception(), cellId, interfaceTheme.getSnapshot().mode));
    context.enterCell(cellId); view.selectArtwork(id);
  });
  const closeImage = () => { imageRequest.current = null; setImageCell(null); };
  const openImage = cellId => perform(() => {
    flush();
    const request = { cellId, store, generation: store.getGeneration() }; imageRequest.current = request;
    const current = () => imageRequest.current === request && store.isCurrent() && store.hasWriteAccess()
      && request.generation === store.getGeneration() && !live.current.disabled;
    imageTarget.current = { captureTarget: () => ({
      async placeAsset(input, dimensions) {
        if (!current()) return false;
        const artwork = await resolveImageLibraryArtwork(input, dimensions, true);
        if (!current()) return false;
        const r = receptionModuleWindow(store.getReception(), cellId);
        if (!r) return false;
        const id = addImageModule(store, view.profileAddress, { cellId, artwork,
          position: { left: r.left, top: r.top }, size: { width: Math.round(r.width), height: Math.round(r.height) } });
        closeImage(); live.current.context.enterCell(cellId); live.current.view.selectArtwork(id); return true;
      },
    }) };
    setImageCell(cellId);
  });
  useEffect(() => context.registerContentActions({ addText, addImage: openImage }));
  const { workbench, cells, imageModules, bento } = reception, transforms = view.transforms;
  // Read-only geometry projection. Authored frames stay in the Reception document;
  // Native geometry and previews use the same frames.
  const painted = useMemo(() => ({ cells, imageModules, bento, workbench: { ...workbench,
    shapes: workbench.shapes.map(item => transforms[item.id]?.frame ? { ...item, window: transforms[item.id].frame } : item) } }),
  [workbench, cells, imageModules, bento, transforms]);
  const settings = receptionBentoSettings(reception);
  const lineFrames = useMemo(() => cells.filter(cell => workbench.shapes.find(item => item.id === cell.id)?.open)
    .map(cell => receptionModuleWindow(painted, cell.id)), [cells, workbench, painted]);
  const project = (r, outset = 0) => ({ left: r.left * view.scale + camera.offset.x - outset, top: r.top * view.scale + camera.offset.y - outset,
    width: r.width * view.scale + outset * 2, height: r.height * view.scale + outset * 2 });
  const selected = context.cells.find(cell => view.selection.length === 1 && view.selection[0] === cell.id);
  const blocked = disabled || camera.locked;
  const selectedFrame = selected && receptionModuleWindow(painted, selected.id);
  const screen = selectedFrame && project(selectedFrame);
  const actionPosition = screen ? {
    left: screen.left, '--toolbar-screen-x': `${screen.left}px`,
    top: Math.max(view.navigationTop + 8, Math.min(screen.top >= view.navigationTop + 52 ? screen.top - 44 : screen.top + screen.height + 8, innerHeight - 48)),
  } : undefined;
  const textReason = selectedFrame && receptionModuleSizeReason('text:new', selectedFrame);
  const imageReason = selectedFrame && receptionModuleSizeReason('image:new', selectedFrame);
  return <>
    <div className="reception-cell-grain-layer" style={{ clipPath: `inset(${view.navigationTop}px 0 0 0)` }}>
      {context.cells.filter(cell => !view.editorHiddenIds.includes(cell.id) && reception.workbench.shapes.find(item => item.id === cell.id)?.open).map(cell => {
        const transform = view.presentationTransforms?.[cell.id] || view.transforms[cell.id];
        const r = transform?.frame || receptionModuleWindow(reception, cell.id);
        const frame = project(r), factor = transform?.scale ?? 1;
        const shape = reception.shapes.find(item => item.id === cell.id);
        const grain = context.paintedCellGrain?.id === cell.id ? context.paintedCellGrain.grain : shape?.grain;
        return <ReceptionCellGrain key={cell.id} cell={cell} grain={grain} scale={view.scale * factor} radius={(cell.radius || 0) * view.scale * factor}
          style={{ left: frame.left + (transform?.x || 0) * view.scale, top: frame.top + (transform?.y || 0) * view.scale,
            width: frame.width * factor, height: frame.height * factor }} />;
      })}
    </div>
    <div className="reception-bento-line-layer" style={{ clipPath: `inset(${view.navigationTop}px 0 0 0)` }}>
      <ReceptionInnerLines frames={lineFrames} gap={preview.current?.next.bento?.gap ?? settings.gap}
        appearance={context.paintedInnerLines} bounds={area} style={project(area)} />
    </div>
    {!disabled && ['select', 'cell'].includes(view.interactionTool) && !navigation.moving && <div ref={snapHost} className="reception-bento-overlay" data-previewing={previewing || undefined} data-workbench-selection-tools
      style={{ clipPath: `inset(${view.navigationTop}px 0 0 0)` }}>
      {view.interactionTool === 'select' && context.cells.filter(cell => cell.id !== context.editingCellId && reception.workbench.shapes.find(item => item.id === cell.id)?.open).map(cell => {
        const r = view.transforms[cell.id]?.frame || receptionModuleWindow(reception, cell.id), active = selected?.id === cell.id;
        return <div key={cell.id} className="reception-bento-cell" data-selected={active || undefined} data-dragging={dragging?.id === cell.id || undefined}
          data-editor-cell-surface={cell.id} style={{ ...project(r), borderRadius: (cell.radius || 0) * view.scale }} tabIndex={0}
          title="Drag to snap; stops at neighbours. Hold Shift to push, Alt for free placement. Alt+Arrow moves 10 px; Alt+Shift+Arrow moves 50 px."
          role="group" aria-label={`${reception.shapes.find(item => item.id === cell.id)?.name || 'Cell'} bento cell`}
          onPointerDown={event => { if (event.target === event.currentTarget) start(event, cell.id); }}
          onClick={event => { if (event.target === event.currentTarget && !gestures.isActive()) view.selectArtwork(cell.id); }}
          onDoubleClick={event => { if (event.target === event.currentTarget && !previewing) context.enterCell(cell.id); }}
          onKeyDown={event => {
            if (event.target !== event.currentTarget || previewing) return;
            if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); context.enterCell(cell.id); }
            if (event.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
              event.preventDefault(); event.stopPropagation();
              const side = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'top', ArrowDown: 'bottom' }[event.key];
              const next = receptionBentoKeyboardTarget(reception, cell.id, side, event.shiftKey);
              if (next) perform(() => run('moveCell', [cell.id, next]));
            }
          }}>
          {active && !previewing && ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].map(edge => <button key={edge} type="button"
            className="reception-bento-cell-handle" data-edge={edge}
            aria-label={'Resize cell ' + { n: 'top', ne: 'top right', e: 'right', se: 'bottom right', s: 'bottom', sw: 'bottom left', w: 'left', nw: 'top left' }[edge]}
            title="Resize with snapping; stops at neighbours. Hold Shift to push, Alt for fine adjustment" onPointerDown={event => start(event, cell.id, edge)}
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || blocked) return;
              event.preventDefault(); event.stopPropagation();
              const step = event.shiftKey ? 10 : 1;
              perform(() => run('resizeCell', [cell.id, edge, event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
                event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0]));
            }} />)}
        </div>;
      })}
      {view.interactionTool === 'select' && !context.editingCellId && !dragging && !previewing && <div className="reception-bento-frame-handles" style={project(area, BENTO_RESIZE_OUTSET)}>
        <span className="reception-bento-dimensions" aria-label="Bento dimensions">{Math.round(area.width)} × {Math.round(area.height)} px</span>
        {['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].map(edge => <button key={edge} type="button" className="reception-bento-frame-handle" data-edge={edge}
          aria-label={'Resize Bento ' + { n: 'top', ne: 'top right', e: 'right', se: 'bottom right', s: 'bottom', sw: 'bottom left', w: 'left', nw: 'top left' }[edge]}
          title="Drag to resize Bento" onPointerDown={event => start(event, null, edge)}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || blocked) return;
            event.preventDefault(); event.stopPropagation();
            const step = event.shiftKey ? 10 : 1;
            perform(() => run('resizeFrame', [edge, event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0]));
          }} />)}
      </div>}
      {drawingFrame && <div className="reception-bento-insertion" aria-hidden="true" data-bento-draw-preview
        style={{ ...project(drawingFrame.frame), borderRadius: drawingFrame.radius * view.scale }} />}
      <WorkbenchSnapGuideOverlay node={snapHost.current} guides={snapGuides} />
          {view.interactionTool === 'select' && selected && !context.editingCellId && !dragging && <div className="reception-bento-cell-actions editor-object-toolbar" data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor" role="toolbar" aria-label="Selected cell actions" style={actionPosition} onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
            <span className="editor-object-toolbar-label">Cell</span>
            {!blocked && !previewing && <CellFillAction key={selected.id} id={selected.id} />}
            {selected.members.length > 0 && <CellPositionButton key={selected.id + '-position'} cellId={selected.id} disabled={blocked || previewing} />}
            <button className="editor-object-toolbar-button" type="button" aria-label="Add cell" title="Draw a cell (C)"
              disabled={blocked || previewing || reception.cells.length >= receptionLayoutCountRange(reception).max}
              onClick={() => perform(() => { cancelPreview(); flush(); context.leaveCell(false); view.setInteractionTool('cell'); hostRef.current?.focus({ preventScroll: true }); })}>+ Cell</button>
            <button className="editor-object-toolbar-button" type="button" data-icon-only="true" aria-label="+ Text" disabled={blocked || previewing || Boolean(textReason)} title={textReason || 'Add text to this cell'} onClick={() => addText(selected.id)}><Type aria-hidden="true" /></button>
            <button className="editor-object-toolbar-button" type="button" data-icon-only="true" aria-label="+ Image" disabled={blocked || previewing || Boolean(imageReason)} title={imageReason || 'Add an image to this cell'} onClick={() => openImage(selected.id)}><Image aria-hidden="true" /></button>
            <button className="editor-object-toolbar-button" type="button" data-icon-only="true" aria-label="Edit cell contents" disabled={blocked || previewing} title="Edit cell contents" onClick={() => context.enterCell(selected.id)}><CornerDownRight aria-hidden="true" /></button>
            <button className="editor-object-toolbar-button" type="button" data-icon-only="true" aria-label="Bento settings" disabled={blocked} title="Whole Bento settings" onClick={() => context.openSettings(selected.id)}><Grid2X2 aria-hidden="true" /></button>
          </div>}
    </div>}
    {context.bentoOpen && !disabled && <ReceptionBentoPanel {...{ reception, blocked, run, previewSettings, cancelPreview }} navigationTop={view.navigationTop}
      onClose={() => context.setBentoOpen(false)} generate={(settings, seed) => {
        cancelPreview(); flush(); store.generateCellLayout(settings, seed, store.getGeneration()); context.leaveCell(false); view.setSelection([]);
        requestAnimationFrame(() => { if (store.isCurrent()) navigation.navigatorHome(); });
      }} />}
    {imageCell && !disabled && <Suspense fallback={null}><LibraryPicker {...{ library }} preferences={libraryPreferences}
      placementScope={`reception:${imageCell}`} placementTargetRef={imageTarget} onClose={closeImage}
      initialTop={view.navigationTop + 16} selectionEnabled active /></Suspense>}
    {error && <p className="reception-bento-error" role="alert" data-workbench-selection-tools>{error}<button type="button" onClick={() => setError('')}>Dismiss</button></p>}
  </>;
}
