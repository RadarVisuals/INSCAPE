import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Image, Type, CornerDownRight, Grid2X2 } from 'lucide-react';
import { useWorkbenchView } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { useWorkbenchCamera } from '../public/ownerSystemWorkflow/WorkbenchCamera.jsx';
import { addImageModule } from '../imageModule/imageModuleSession.js';
import { resolveImageLibraryArtwork } from '../imageModule/imageLibraryArtwork.js';
import { addTextModule } from '../text/textSession.js';
import { interfaceTheme } from '../interfaceTheme.js';
import { receptionTextDefaults } from './receptionTextDefaults.js';
import { createWorkbenchGestures } from '../public/ownerSystemWorkflow/workbenchGestures.js';
import { useEditorCells } from './EditorCellsContext.jsx';
import { CellPositionButton } from './EditorCellPositionControls.jsx';
import { receptionModuleWindow, receptionModuleSizeReason } from './receptionEditorDocument.js';
import { receptionBentoSettings, receptionBentoDividers, receptionBentoEqualPosition, resizeReceptionBento, setReceptionBentoSettings } from './receptionBento.js';
import { insertReceptionBentoCell, receptionBentoInsertionTargets, receptionBentoInsertionDistance } from './receptionBentoInsertion.js';
import { receptionLayoutCountRange } from './receptionLayoutGenerator.js';
import ReceptionBentoPanel from './ReceptionBentoPanel.jsx';
import ReceptionInnerLines from './ReceptionInnerLines.jsx';
import { OwnerSystemWorkflowSelectMenu } from '../public/ownerSystemWorkflow/OwnerSystemWorkflowWorkspaceControls.jsx';
import { workbenchArea } from '../systemWorkflow/domain/workbenchArea.js';
import './receptionBento.css';

const LibraryPicker = lazy(() => import('../library/ProfileLibraryPicker.jsx'));
function CellFillAction({ id }) {
  const view = useWorkbenchView();
  useSyncExternalStore(view.subscribeTools, view.toolsSnapshot);
  return view.toolSources.get(id)?.current.cellFill ?? null;
}

function insertionPlans(value, id) {
  return receptionBentoInsertionTargets(value, id).flatMap(target => {
    try { const next = insertReceptionBentoCell(value, id, target); return next === value ? [] : [{ ...target, next }]; }
    catch { return []; } // Content/geometry limits make this boundary unavailable.
  });
}

export default function ReceptionBentoEditor(props) {
  const context = useEditorCells();
  return context ? <BentoEditor key={context.store.getProfileAddress()} context={context} {...props} /> : null;
}
function BentoEditor({ context, disabled, navigation, flushLayout, library, libraryPreferences }) {
  const view = useWorkbenchView(), camera = useWorkbenchCamera(), store = context.store;
  const reception = store.getReception(), gestureHost = useRef(null), live = useRef(null), imageRequest = useRef(null);
  const [dragging, setDragging] = useState(null), [error, setError] = useState(''), [imageCell, setImageCell] = useState(null);
  const imageTarget = useRef(null), preview = useRef(null);
  const [previewing, setPreviewing] = useState(false), [equalDivider, setEqualDivider] = useState(null);
  live.current = { view, context, disabled, flushLayout };
  const [gestures] = useState(() => createWorkbenchGestures({
    getHost: () => gestureHost.current,
    restoreTransforms: transforms => live.current.view.setTransforms(transforms),
  }));
  const cancelPreview = useCallback(() => {
    if (!preview.current) return;
    const { previous } = preview.current; preview.current = null;
    live.current.view.setTransforms(previous); setPreviewing(false);
  }, []);
  const previewSettings = useCallback(settings => {
    if (!store.isCurrent() || !store.hasWriteAccess() || live.current.disabled) return;
    if (!preview.current && !live.current.flushLayout()) throw new Error('Save the current edit before previewing the bento.');
    const origin = store.getReception(), next = setReceptionBentoSettings(origin, settings);
    if (!preview.current) preview.current = { previous: live.current.view.transforms, generation: store.getGeneration() };
    preview.current.next = next;
    live.current.view.setTransforms({ ...preview.current.previous, ...Object.fromEntries(origin.cells.map(cell => [cell.id,
      { scale: 1, x: 0, y: 0, frame: receptionModuleWindow(next, cell.id), cellRadius: next.cells.find(item => item.id === cell.id).radius }])) });
    setPreviewing(true);
  }, [store]);
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
    const unguard = store.guardWorkbenchTransition(() => { cancelPreview(); return gestures.isActive() ? 'Finish or cancel the bento gesture before leaving Reception.' : null; });
    return () => { cancel(); cancelPreview(); imageRequest.current = null; unsubscribe(); unguard(); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); };
  }, [store, cancelPreview, gestures, cancel]);
  useEffect(() => { if (disabled) { cancel(); cancelPreview(); imageRequest.current = null; setImageCell(null); } }, [disabled, cancelPreview, cancel]);
  const start = (event, cellId, divider) => {
    if (event.button !== 0 || disabled || camera.locked || gestures.isActive() || preview.current) return;
    event.preventDefault(); event.stopPropagation();
    perform(() => {
      flush();
      const origin = store.getReception(), generation = store.getGeneration();
      const { scale, offset } = camera.getCamera(), target = event.currentTarget;
      const initial = { x: event.clientX, y: event.clientY }, previous = view.transforms;
      const equalPosition = divider ? receptionBentoEqualPosition(origin, divider) : null;
      const insertions = cellId ? insertionPlans(origin, cellId) : [];
      let destination = null, position = divider?.position, moved = false, unlock;
      if (cellId) { context.leaveCell(false); view.selectArtwork(cellId); }
      target.focus({ preventScroll: true }); gestureHost.current = target;
      const paint = next => view.setTransforms({ ...previous, ...Object.fromEntries(origin.cells.map(cell => [cell.id,
        { scale: 1, x: 0, y: 0, frame: receptionModuleWindow(next, cell.id) }])) });
      const started = gestures.beginResize(event, {
        beforeTransforms: previous,
        valid: () => target.isConnected && store.isCurrent() && store.hasWriteAccess()
          && store.getGeneration() === generation && !live.current.disabled,
        preview: delta => {
          moved ||= Math.hypot(delta.x, delta.y) > 4;
          if (!moved) return;
          try {
            if (divider) {
              position = divider.position + (divider.axis === 'x' ? delta.x : delta.y) / scale;
              const snapped = equalPosition !== null && Math.abs(position - equalPosition) * scale <= 6;
              if (snapped) position = equalPosition;
              setEqualDivider(snapped ? divider.id : null);
              paint(resizeReceptionBento(origin, divider.id, position));
            } else {
              const x = (initial.x + delta.x - offset.x) / scale, y = (initial.y + delta.y - offset.y) / scale;
              const distance = t => receptionBentoInsertionDistance(t, {x,y}, scale);
              destination = insertions.filter(t => distance(t) <= 32).sort((a, b) => distance(a) - distance(b))[0] || null;
              if (destination) paint(destination.next);
              else {
                const frame = receptionModuleWindow(origin, cellId);
                view.setTransforms({ ...previous, [cellId]: { scale: 1, x: 0, y: 0,
                  frame: { ...frame, left: frame.left + delta.x / scale, top: frame.top + delta.y / scale } } });
              }
              setDragging({ id: cellId, slot: destination ? receptionModuleWindow(destination.next, cellId) : null,
                area: destination?.next.workbench.area });
            }
            setError('');
          } catch (failure) { setError(failure.message); gestures.cancel(); }
        },
        commit: () => {
          view.setTransforms(previous);
          if (!moved || !divider && !destination) return true;
          try {
            store.editBento(divider ? 'resize' : 'insert', divider ? [divider.id, position] : [cellId, { targetId: destination.targetId, side: destination.side }], generation);
            setError(''); return true;
          } catch (failure) { setError(failure.message); return false; }
        },
        onFinish: () => { unlock?.(); setDragging(null); setEqualDivider(null); },
      });
      if (started) unlock = camera.lock();
    });
  };
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
  const painted = { ...reception, workbench: { ...reception.workbench,
    shapes: reception.workbench.shapes.map(item => view.transforms[item.id]?.frame ? { ...item, window: view.transforms[item.id].frame } : item) } };
  const settings = receptionBentoSettings(reception), dividers = receptionBentoDividers(painted);
  const lineFrames = reception.cells.filter(cell => reception.workbench.shapes.find(item => item.id === cell.id)?.open)
    .map(cell => receptionModuleWindow(painted, cell.id));
  const area = dragging?.area || workbenchArea(reception.workbench);
  const project = r => ({ left: r.left * view.scale + camera.offset.x, top: r.top * view.scale + camera.offset.y,
    width: r.width * view.scale, height: r.height * view.scale });
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
    <div className="reception-bento-line-layer" style={{ clipPath: `inset(${view.navigationTop}px 0 0 0)` }}>
      <ReceptionInnerLines frames={lineFrames} gap={preview.current?.next.bento?.gap ?? settings.gap}
        appearance={context.paintedInnerLines} bounds={area} style={project(area)} />
    </div>
    {!disabled && view.interactionTool === 'select' && !navigation.moving && <div className="reception-bento-overlay" data-previewing={previewing || undefined} data-workbench-selection-tools
      style={{ clipPath: `inset(${view.navigationTop}px 0 0 0)` }}>
      {context.cells.filter(cell => cell.id !== context.editingCellId && reception.workbench.shapes.find(item => item.id === cell.id)?.open).map(cell => {
        const r = view.transforms[cell.id]?.frame || receptionModuleWindow(reception, cell.id), active = selected?.id === cell.id;
        return <div key={cell.id} className="reception-bento-cell" data-selected={active || undefined} data-dragging={dragging?.id === cell.id || undefined}
          data-editor-cell-surface={cell.id} style={{ ...project(r), borderRadius: (cell.radius || 0) * view.scale }} tabIndex={0}
          role="group" aria-label={`${reception.shapes.find(item => item.id === cell.id)?.name || 'Cell'} bento cell`}
          onPointerDown={event => { if (event.target === event.currentTarget) start(event, cell.id); }}
          onClick={event => { if (event.target === event.currentTarget && !gestures.isActive()) view.selectArtwork(cell.id); }}
          onDoubleClick={() => { if (!previewing) context.enterCell(cell.id); }}
          onKeyDown={event => {
            if (event.target !== event.currentTarget || previewing) return;
            if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); context.enterCell(cell.id); }
            if (event.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
              event.preventDefault(); event.stopPropagation();
              const axis = ['ArrowLeft', 'ArrowRight'].includes(event.key) ? 'x' : 'y';
              const forward = ['ArrowRight', 'ArrowDown'].includes(event.key), frame = receptionModuleWindow(reception, cell.id);
              const edge = axis === 'x' ? frame.left + (forward ? frame.width : 0) : frame.top + (forward ? frame.height : 0);
              const next = insertionPlans(reception, cell.id).filter(t => t.axis === axis && (forward ? t.position > edge : t.position < edge))
                .sort((a, b) => Math.abs(a.position - edge) - Math.abs(b.position - edge))[0];
              if (next) perform(() => run('insert', [cell.id, { targetId: next.targetId, side: next.side }]));
            }
          }}>
        </div>;
      })}
      {dragging?.slot && <div className="reception-bento-insertion" aria-hidden="true" data-bento-insertion
        style={project(dragging.slot)} />}
      {!context.editingCellId && !previewing && dividers.map(d => {
        const x = d.axis === 'x', position = d.position - settings.gap / 2;
        // Cover the gutter and six screen pixels inside each neighbouring cell.
        // The visible borders remain draggable at every camera zoom and spacing.
        const hitSize = settings.gap * view.scale + 12;
        return <button key={d.id} className="reception-bento-divider" data-axis={d.axis} data-equal={equalDivider === d.id || undefined} type="button"
          role="separator" aria-label={x ? 'Resize adjacent columns' : 'Resize adjacent rows'} aria-orientation={x ? 'vertical' : 'horizontal'}
          title={x ? 'Drag to resize adjacent columns' : 'Drag to resize adjacent rows'}
          aria-valuemin={d.min} aria-valuemax={d.max} aria-valuenow={d.position}
          style={{ left: (x ? position : d.from) * view.scale + camera.offset.x - (x ? hitSize / 2 : 0),
            top: (x ? d.from : position) * view.scale + camera.offset.y - (x ? 0 : hitSize / 2),
            width: x ? hitSize : (d.to - d.from - settings.gap) * view.scale, height: x ? (d.to - d.from - settings.gap) * view.scale : hitSize }}
          onPointerDown={event => start(event, null, d)}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || blocked) return;
            event.preventDefault(); event.stopPropagation();
            perform(() => run('resize', [d.id, d.position + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) * (event.shiftKey ? 10 : 1)]));
          }} />;
      })}
          {selected && !context.editingCellId && !dragging && <div className="reception-bento-cell-actions editor-object-toolbar" data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor" role="toolbar" aria-label="Selected cell actions" style={actionPosition} onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
            <span className="editor-object-toolbar-label">Cell</span>
            {!blocked && !previewing && <CellFillAction key={selected.id} id={selected.id} />}
            {selected.members.length > 0 && <CellPositionButton key={selected.id + '-position'} cellId={selected.id} disabled={blocked || previewing} />}
            <OwnerSystemWorkflowSelectMenu flat compact palette="editor" className="editor-object-toolbar-button reception-bento-add-cell" label="Add cell" triggerPrefix="+ Cell" defaultValue="" value=""
              disabled={blocked || previewing || reception.cells.length >= receptionLayoutCountRange(reception).max}
              options={[{ value: 'left', label: 'Left of this row' }, { value: 'right', label: 'Right of this row' },
                { value: 'above', label: 'Above Bento' }, { value: 'below', label: 'Below Bento' }]}
              onChange={direction => perform(() => ['left', 'right'].includes(direction)
                ? run(direction === 'left' ? 'prependCell' : 'addCell', [selected.id]) : run(direction === 'above' ? 'prependRow' : 'appendRow', []))} />
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
