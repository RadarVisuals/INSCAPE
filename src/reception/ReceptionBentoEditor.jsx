import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useWorkbenchView } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { useWorkbenchCamera } from '../public/ownerSystemWorkflow/WorkbenchCamera.jsx';
import { addImageModule } from '../imageModule/imageModuleSession.js';
import { resolveImageLibrarySide } from '../imageModule/imageLibrarySide.js';
import { addTextModule } from '../text/textSession.js';
import { interfaceTheme } from '../interfaceTheme.js';
import { receptionTextDefaults } from './receptionTextDefaults.js';
import { createWorkbenchGestures } from '../public/ownerSystemWorkflow/workbenchGestures.js';
import { useEditorCells, editorCellStructureActions } from './EditorCellsContext.jsx';
import { receptionModuleWindow, receptionModuleSizeReason } from './receptionEditorDocument.js';
import { receptionBentoSettings, receptionBentoDividers, resizeReceptionBento, swapReceptionBentoCells, setReceptionBentoSettings } from './receptionBento.js';
import { receptionLayoutCountRange } from './receptionLayoutGenerator.js';
import ReceptionBentoPanel from './ReceptionBentoPanel.jsx';
import ReceptionInnerLines from './ReceptionInnerLines.jsx';
import { workbenchArea } from '../systemWorkflow/domain/workbenchArea.js';
import './receptionBento.css';

const LibraryPicker = lazy(() => import('../library/ProfileLibraryPicker.jsx'));
export default function ReceptionBentoEditor(props) {
  const context = useEditorCells();
  return context ? <BentoEditor key={context.store.getProfileAddress()} context={context} {...props} /> : null;
}
function BentoEditor({ context, disabled, navigation, flushLayout, library, libraryPreferences }) {
  const view = useWorkbenchView(), camera = useWorkbenchCamera(), store = context.store;
  const reception = store.getReception(), gestureHost = useRef(null), live = useRef(null), imageRequest = useRef(null);
  const [dragging, setDragging] = useState(null), [error, setError] = useState(''), [imageCell, setImageCell] = useState(null);
  const imageTarget = useRef(null), preview = useRef(null);
  const [previewing, setPreviewing] = useState(false);
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
    if (action === 'appendRow') {
      const generation = store.getGeneration();
      requestAnimationFrame(() => { if (store.isCurrent() && store.getGeneration() === generation) navigation.navigatorHome(); });
    }
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
              paint(resizeReceptionBento(origin, divider.id, position));
            } else {
              const x = (initial.x + delta.x - offset.x) / scale, y = (initial.y + delta.y - offset.y) / scale;
              destination = origin.cells.find(cell => {
                const r = receptionModuleWindow(origin, cell.id);
                return cell.id !== cellId && x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height;
              })?.id || null;
              paint(destination ? swapReceptionBentoCells(origin, cellId, destination) : origin);
              setDragging({ id: cellId, target: destination });
            }
            setError('');
          } catch (failure) { setError(failure.message); gestures.cancel(); }
        },
        commit: () => {
          view.setTransforms(previous);
          if (!moved || !divider && !destination) return true;
          try {
            store.editBento(divider ? 'resize' : 'swap', divider ? [divider.id, position] : [cellId, destination], generation);
            setError(''); return true;
          } catch (failure) { setError(failure.message); return false; }
        },
        onFinish: () => { unlock?.(); setDragging(null); },
      });
      if (started) unlock = camera.lock();
    });
  };
  const cellStore = cellId => ({ ...store, commitCompletedOperation: (candidate, options) => store.commitInCell(cellId, candidate, options) });
  const addText = cellId => perform(() => {
    flush(); const r = receptionModuleWindow(store.getReception(), cellId);
    const id = addTextModule(cellStore(cellId), view.profileAddress, { window: r },
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
        const side = await resolveImageLibrarySide(input, dimensions, true);
        if (!current()) return false;
        const r = receptionModuleWindow(store.getReception(), cellId);
        if (!r) return false;
        const id = addImageModule(cellStore(cellId), view.profileAddress, { side,
          position: { left: r.left, top: r.top }, size: { width: Math.round(r.width), height: Math.round(r.height) } });
        closeImage(); live.current.context.enterCell(cellId); live.current.view.selectArtwork(id); return true;
      },
    }) };
    setImageCell(cellId);
  });
  const painted = { ...reception, workbench: { ...reception.workbench,
    shapes: reception.workbench.shapes.map(item => view.transforms[item.id]?.frame ? { ...item, window: view.transforms[item.id].frame } : item) } };
  const settings = receptionBentoSettings(reception), dividers = receptionBentoDividers(painted);
  const lineFrames = reception.cells.filter(cell => reception.workbench.shapes.find(item => item.id === cell.id)?.open)
    .map(cell => receptionModuleWindow(painted, cell.id));
  const area = workbenchArea(reception.workbench);
  const project = r => ({ left: r.left * view.scale + camera.offset.x, top: r.top * view.scale + camera.offset.y,
    width: r.width * view.scale, height: r.height * view.scale });
  const selected = context.cells.find(cell => view.selection.length === 1 && view.selection[0] === cell.id);
  const blocked = disabled || camera.locked;
  const selectedFrame = selected && receptionModuleWindow(painted, selected.id);
  const screen = selectedFrame && project(selectedFrame);
  const actionPosition = screen ? {
    left: Math.max(8, Math.min(screen.left, innerWidth - 372)),
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
        return <div key={cell.id} className="reception-bento-cell" data-selected={active || undefined} data-swap-target={dragging?.target === cell.id || undefined}
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
              const index = context.cells.indexOf(cell), next = context.cells[index + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1)];
              if (next) perform(() => run('swap', [cell.id, next.id]));
            }
          }}>
        </div>;
      })}
      {!context.editingCellId && !previewing && dividers.map(d => {
        const x = d.axis === 'x', position = d.position - settings.gap / 2;
        // Cover the gutter and six screen pixels inside each neighbouring cell.
        // The visible borders remain draggable at every camera zoom and spacing.
        const hitSize = settings.gap * view.scale + 12;
        return <button key={d.id} className="reception-bento-divider" data-axis={d.axis} type="button"
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
          {selected && !context.editingCellId && !dragging && <div className="reception-bento-cell-actions workbench-tool-controls" data-workflow-material="tactile" data-workflow-finish="flat" data-window-chrome="flat" role="toolbar" aria-label="Selected cell actions" style={actionPosition} onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
            <button className="workflow-tactile-control" type="button" disabled={blocked || previewing || reception.cells.length >= receptionLayoutCountRange(reception).max}
              title="Add a cell on the right of this row; the row keeps its total width" onClick={() => perform(() => run('addCell', [selected.id]))}>+ Cell</button>
            <button className="workflow-tactile-control" type="button" disabled={blocked || previewing || Boolean(imageReason)} title={imageReason || undefined} onClick={() => openImage(selected.id)}>+ Image</button>
            <button className="workflow-tactile-control" type="button" disabled={blocked || previewing || Boolean(textReason)} title={textReason || undefined} onClick={() => addText(selected.id)}>+ Text</button>
            <button className="workflow-tactile-control" type="button" disabled={blocked} onClick={() => context.openSettings(selected.id)}>Bento settings</button>
          </div>}
    </div>}
    {context.bentoOpen && !disabled && <ReceptionBentoPanel {...{ reception, blocked, run, previewSettings, cancelPreview }} selectedId={selected?.id} structureActions={selected ? editorCellStructureActions(store, selected.id, view) : []} revision={store.getGeneration()} navigationTop={view.navigationTop}
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
