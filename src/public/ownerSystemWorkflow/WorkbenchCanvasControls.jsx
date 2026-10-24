import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Frame, Maximize, Scan, Eye, X } from 'lucide-react';
import { useWorkbenchArea } from './WorkbenchAreaContext.jsx';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import { fitWorkbenchArea, resizeWorkbenchArea } from '../../systemWorkflow/domain/workbenchArea.js';
import { resizeWorkbenchCanvas } from '../../systemWorkflow/workbenchAreaSession.js';
import { WORKBENCH_GROUP_STACK_SIZE } from '../../systemWorkflow/domain/workbenchGroups.js';
import './workbenchCanvasControls.css';

export default function WorkbenchCanvasControls({ hostRef, navigation, historyBlocked }) {
  const view = useWorkbenchView(), areaContext = useWorkbenchArea(), camera = useWorkbenchCamera();
  const draft = useSyncExternalStore(view.store.subscribe, view.store.getSnapshot);
  const [open, setOpen] = useState(false), [error, setError] = useState('');
  const [projection, setProjection] = useState(camera.getCamera);
  const [viewport, setViewport] = useState(null);
  const drag = useRef(null), trigger = useRef(null), latest = useRef(null);
  useEffect(() => view.store?.guardWorkbenchTransition?.(() => drag.current
    ? 'Finish or cancel resizing the canvas before switching Workbenches.' : null), [view.store]);
  latest.current = { view, areaContext, camera, historyBlocked, navigation };
  const finish = useCallback((cancel = false) => {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    if (active.target.hasPointerCapture(active.id)) active.target.releasePointerCapture(active.id);
    active.unlock();
    if (!cancel && active.next) {
      try { resizeWorkbenchCanvas(active.store, active.profile, active.generation, active.next, active.presentation); setError(''); }
      catch (failure) { setError(failure.message); }
    }
    latest.current.areaContext.setPreview(null);
  }, []);
  const close = () => { finish(true); setOpen(false); trigger.current?.focus({ preventScroll: true }); };
  useEffect(() => {
    const cancel = () => finish(true);
    const hidden = () => { if (document.hidden) cancel(); };
    const key = event => {
      if (event.key !== 'Escape' || !open) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (drag.current) cancel(); else { setOpen(false); trigger.current?.focus({ preventScroll: true }); }
    };
    addEventListener('keydown', key, true); addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', hidden);
    return () => { removeEventListener('keydown', key, true); removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', hidden); cancel(); };
  }, [open, finish]);
  useEffect(() => {
    const active = drag.current;
    if (active && (view.store.getGeneration() !== active.generation || historyBlocked)) finish(true);
  }, [draft, historyBlocked, view.store, finish]);
  useLayoutEffect(() => {
    if (!open || !hostRef.current) return;
    const measure = () => { finish(true); setViewport(hostRef.current.getBoundingClientRect()); };
    const observer = new ResizeObserver(measure); observer.observe(hostRef.current); measure();
    const unsubscribe = camera.subscribeCameraPaint(next => {
      const active = drag.current;
      if (active && (next.scale !== active.camera.scale || next.offset.x !== active.camera.offset.x || next.offset.y !== active.camera.offset.y)) finish(true);
      setProjection(next);
    });
    return () => { observer.disconnect(); unsubscribe(); };
  }, [open, hostRef, camera.subscribeCameraPaint, finish]);
  useLayoutEffect(() => { if (open) setProjection(camera.getCamera()); }, [open, camera.scale, camera.offset, camera.getCamera]);

  const blocked = Boolean(historyBlocked || navigation.locked && !drag.current);
  const commit = area => {
    if (blocked || !area) return;
    try { resizeWorkbenchCanvas(view.store, view.profileAddress, view.store.getGeneration(), area, view.getPresentation()); setError(''); }
    catch (failure) { setError(failure.message); }
  };
  const fit = () => {
    // Module-owned frames are exact world coordinates. Tool windows do not
    // register as content; collapsed groups contribute their stack instead.
    const frames = [...view.frames].flatMap(([id, reference]) => {
      const node = view.entries.get(id), frame = reference.current;
      if (!node || node.hasAttribute('data-workbench-group-hidden') || !frame) return [];
      const transform = view.transforms[id] || { scale: 1, x: 0, y: 0 };
      return [{ left: frame.left * transform.scale + transform.x, top: frame.top * transform.scale + transform.y,
        width: frame.width * transform.scale, height: frame.height * transform.scale }];
    });
    for (const group of draft.workbenchGroups || []) if (group.position) frames.push({ ...group.position, ...WORKBENCH_GROUP_STACK_SIZE });
    try {
      const area = fitWorkbenchArea(frames);
      if (!area) { setError('Open some content on the canvas first.'); return; }
      commit(area);
    } catch (failure) { setError(failure.message); }
  };
  const begin = (event, edge) => {
    if (blocked || drag.current || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true });
    navigation.stopTravel();
    drag.current = { id: event.pointerId, target: event.currentTarget, x: event.clientX, y: event.clientY, edge,
      area: areaContext.area, camera: camera.getCamera(), store: view.store, profile: view.profileAddress,
      generation: view.store.getGeneration(), presentation: view.getPresentation(), unlock: camera.lock() };
    setError(''); event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = event => {
    const active = drag.current;
    if (active?.id !== event.pointerId) return;
    active.next = resizeWorkbenchArea(active.area, active.edge,
      { x: (event.clientX - active.x) / active.camera.scale, y: (event.clientY - active.y) / active.camera.scale });
    areaContext.setPreview(active.next);
  };
  const resizeByKey = (event, edge) => {
    if (blocked || drag.current || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.altKey ? 1 : event.shiftKey ? 100 : 10;
    commit(resizeWorkbenchArea(areaContext.area, edge, { x: event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0,
      y: event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0 }));
  };
  const area = areaContext.area;
  const left = (viewport?.left || 0) + projection.offset.x + area.left * projection.scale;
  const top = (viewport?.top || 0) + projection.offset.y + area.top * projection.scale;
  const right = left + area.width * projection.scale, bottom = top + area.height * projection.scale;
  const edgeLeft = Math.max(left, viewport?.left || 0), edgeTop = Math.max(top, viewport?.top || 0);
  const edgeRight = Math.min(right, viewport?.right || 0), edgeBottom = Math.min(bottom, viewport?.bottom || 0);
  const verticalVisible = x => viewport && x >= viewport.left && x <= viewport.right && edgeBottom > edgeTop;
  const horizontalVisible = y => viewport && y >= viewport.top && y <= viewport.bottom && edgeRight > edgeLeft;
  const leftVisible = verticalVisible(left), rightVisible = verticalVisible(right);
  const topVisible = horizontalVisible(top), bottomVisible = horizontalVisible(bottom);
  const handle = (edge, style, label) => <button key={edge} type="button" className={`workbench-canvas-edge is-${edge}`} style={style}
    aria-label={label} title={`${label} · Arrow keys: 10 px · Shift: 100 px · Alt: 1 px`} data-system-workflow-overlay
    onPointerDown={event => begin(event, edge)} onPointerMove={move}
    onPointerUp={event => { if (drag.current?.id === event.pointerId) finish(); }}
    onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish(true)} onKeyDown={event => resizeByKey(event, edge)} />;
  return <>
    <button ref={trigger} type="button" className="workflow-tactile-control" aria-label="Canvas size" title="Canvas size"
      aria-expanded={open} disabled={blocked} onClick={() => { if (open) close(); else { view.setInteractionTool('select'); setOpen(true); setError(''); } }}><Frame /></button>
    {open && <div className="workbench-canvas-tools" data-system-workflow-overlay role="group" aria-label="Canvas size controls">
      <div className="workbench-canvas-tools__heading"><strong>Canvas</strong><output aria-label="Canvas dimensions">{area.width} × {area.height}</output>
        <button className="workflow-tactile-control" type="button" aria-label="Close canvas size" onClick={close}><X /></button></div>
      <p>Drag any edge or corner. Artwork outside is hidden, not removed.</p>
      <button className="workflow-tactile-control" type="button" disabled={blocked}
        aria-pressed={areaContext.showOutside} onClick={() => areaContext.setShowOutside(value => !value)}>
        <Eye />Show outside canvas</button>
      <button className="workflow-tactile-control" type="button" disabled={blocked} onClick={fit}
        title="Fit to the object edges without extra margin"><Maximize />Fit canvas to content</button>
      <button className="workflow-tactile-control" type="button" disabled={blocked} onClick={() => navigation.focusDestination({
        getBounds: () => ({ left: area.left + area.width - 300, top: area.top + area.height - 200, width: 600, height: 400 }),
      })}><Scan />Find resize corner</button>
      {(error || historyBlocked) && <p role="alert">{error || historyBlocked}</p>}
    </div>}
    {open && !blocked && hostRef.current && createPortal(<>
      {(leftVisible || drag.current?.edge === 'w') && handle('w', { left, top: edgeTop, height: edgeBottom - edgeTop }, 'Resize canvas from left')}
      {(topVisible || drag.current?.edge === 'n') && handle('n', { left: edgeLeft, top, width: edgeRight - edgeLeft }, 'Resize canvas from top')}
      {(rightVisible || drag.current?.edge === 'e') && handle('e', { left: right, top: edgeTop, height: edgeBottom - edgeTop }, 'Resize canvas width')}
      {(bottomVisible || drag.current?.edge === 's') && handle('s', { left: edgeLeft, top: bottom, width: edgeRight - edgeLeft }, 'Resize canvas height')}
      {(leftVisible && topVisible || drag.current?.edge === 'nw') && handle('nw', { left, top }, 'Resize canvas from top left')}
      {(rightVisible && topVisible || drag.current?.edge === 'ne') && handle('ne', { left: right, top }, 'Resize canvas from top right')}
      {(leftVisible && bottomVisible || drag.current?.edge === 'sw') && handle('sw', { left, top: bottom }, 'Resize canvas from bottom left')}
      {(rightVisible && bottomVisible || drag.current?.edge === 'se') && handle('se', { left: right, top: bottom }, 'Resize canvas width and height')}
    </>, hostRef.current)}
  </>;
}
