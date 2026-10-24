import { useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { clampOwnerSystemWorkflowWindowPosition, resizeWorkbenchWindow, WORKBENCH_RESIZE_EDGES } from './ownerSystemWorkflowWindowGeometry.js';
import './workbenchToolPanel.css';
import { useWorkbenchView } from './WorkbenchViewContext.js';

// Screen-only tool chrome. Artwork, camera, selection and saving stay with callers.
export default function WorkbenchToolPanel({ label, title, titleContent, moveLabel, headerContent, children, onClose, active = false, zIndex = active ? 85 : 84, onActivate, className = '', frame, onFrameChange: setFrame, panelRef, closeLabel, onMoveStart, onMove, onMoveEnd, minimumWidth = 280, minimumHeight = 240, viewportBottom, topBoundaryRef, fitFromTop = false }) {
  const { navigationInset = 0, navigationTop = 0 } = useWorkbenchView();
  const [viewport, setViewport] = useState(() => ({ width: innerWidth, height: innerHeight }));
  const [boundaryTop, setTop] = useState(0);
  const top = Math.max(boundaryTop, navigationTop);
  const gesture = useRef(null), latest = useRef(null);
  const bottom = Math.min(viewport.height, viewportBottom ?? viewport.height - 48);
  const bounds = { left: Math.max(8, navigationInset), top: top + 8, right: viewport.width - 8, bottom: bottom - 8 };
  const clamp = candidate => {
    const size = { width: Math.max(1, Math.min(candidate.width, bounds.right - bounds.left)), height: Math.max(1, Math.min(candidate.height, bounds.bottom - bounds.top)) };
    const next = clampOwnerSystemWorkflowWindowPosition({ x: candidate.left, y: candidate.top - top }, size, { width: viewport.width, height: bottom - top });
    return { left: Math.max(bounds.left, Math.min(bounds.right - size.width, next.x)), top: next.y + top, ...size };
  };
  const placed = clamp(frame);
  const resized = (start, edge, delta) => resizeWorkbenchWindow(start, edge, delta, { width: minimumWidth, height: minimumHeight }, bounds);
  const release = drag => { if (drag?.element.hasPointerCapture(drag.id)) drag.element.releasePointerCapture(drag.id); };
  const finish = (cancelled, event) => {
    const drag = gesture.current;
    if (!drag) return;
    gesture.current = null;
    if (cancelled) setFrame(drag.frame);
    release(drag);
    if (!drag.edge) onMoveEnd?.(cancelled, event);
  };
  // Long independent tools can shorten above wrapping camera controls without
  // moving over their module's action strip. Drag and resize keep normal bounds.
  latest.current = { finish, clamp, setFrame, fit: candidate => clamp(fitFromTop
    ? { ...candidate, height: Math.min(candidate.height, Math.max(minimumHeight, bounds.bottom - candidate.top)) } : candidate) };

  useLayoutEffect(() => {
    const boundary = topBoundaryRef?.current;
    if (!boundary) return;
    const measure = () => setTop(boundary.getBoundingClientRect().bottom);
    const observer = new ResizeObserver(measure);
    observer.observe(boundary); window.addEventListener('resize', measure); measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [topBoundaryRef]);

  useLayoutEffect(() => {
    const cancel = () => latest.current.finish(true);
    const resize = () => { cancel(); setViewport({ width: innerWidth, height: innerHeight }); };
    const visibility = () => { if (document.hidden) cancel(); };
    const escape = event => {
      if (event.key !== 'Escape' || !gesture.current) return;
      event.preventDefault(); event.stopPropagation(); cancel();
    };
    window.addEventListener('resize', resize);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('keydown', escape, true);
      const drag = gesture.current; gesture.current = null; release(drag);
    };
  }, []);
  useLayoutEffect(() => {
    latest.current.finish(true);
    latest.current.setFrame(current => {
      const next = latest.current.fit(current);
      return Object.keys(next).every(key => next[key] === current[key]) ? current : next;
    });
  }, [viewport.width, top, bottom, navigationInset]);

  const begin = (event, edge = null) => {
    if (event.button !== 0 || !event.isPrimary || gesture.current) return;
    event.stopPropagation();
    // Pointer resizing must stay invisible, even after keyboard resizing left
    // this same target focused. Tab can still reveal the keyboard resize target.
    if (edge) { event.preventDefault(); event.currentTarget.blur(); }
    gesture.current = { id: event.pointerId, element: event.currentTarget, x: event.clientX, y: event.clientY, frame, start: placed, edge };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!edge) onMoveStart?.(event);
    // The title button keeps native pointer-versus-keyboard focus behavior.
  };
  const move = event => {
    const drag = gesture.current;
    if (!drag || event.pointerId !== drag.id) return;
    event.stopPropagation();
    const delta = { x: event.clientX - drag.x, y: event.clientY - drag.y };
    setFrame(drag.edge ? resized(drag.start, drag.edge, delta) : clamp({ ...drag.start, left: drag.start.left + delta.x, top: drag.start.top + delta.y }));
    if (!drag.edge) onMove?.(event);
  };
  const end = (event, cancelled) => {
    if (event.pointerId !== gesture.current?.id) return;
    event.stopPropagation(); finish(cancelled, event);
  };
  const key = (event, edge = null) => {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!delta || event.ctrlKey || event.metaKey || gesture.current) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.altKey ? 1 : event.shiftKey ? 24 : 8;
    setFrame(edge ? resized(placed, edge, { x: delta[0] * step, y: delta[1] * step })
      : clamp({ ...placed, left: placed.left + delta[0] * step, top: placed.top + delta[1] * step }));
  };

  const renderHeader = (content = headerContent, close = onClose, closeName = closeLabel || `Close ${label}`) => (
    <header className="workbench-tool-panel-header">
      {content}
      <button type="button" className="workbench-tool-panel-grip" aria-label={moveLabel || `Move ${title} panel`}
        title="Drag to move; use arrow keys when focused" onKeyDown={event => key(event)} onPointerDown={event => begin(event)} onPointerMove={move}
        onPointerUp={event => end(event, false)} onPointerCancel={event => end(event, true)} onLostPointerCapture={event => end(event, true)}>{content ? null : titleContent || title}</button>
      <button type="button" className="workbench-tool-panel-close" aria-label={closeName} onClick={close}><X /></button>
    </header>
  );
  return <section ref={panelRef} className={`workbench-tool-panel ${className}`} aria-label={label}
    style={{ ...placed, zIndex }} onPointerDownCapture={onActivate} onFocusCapture={onActivate}>
    {typeof children === 'function' ? children(renderHeader) : <>{renderHeader()}<div className="workbench-tool-panel-content">{children}</div></>}
    {WORKBENCH_RESIZE_EDGES.map(([edge, name]) => <button key={edge} type="button" className="workbench-tool-panel-resize"
      data-edge={edge} tabIndex={edge === 'se' ? 0 : -1} aria-label={`Resize ${title} panel${name ? ` from ${name}` : ''}`}
      onKeyDown={event => key(event, edge)} onPointerDown={event => begin(event, edge)} onPointerMove={move}
      onPointerUp={event => end(event, false)} onPointerCancel={event => end(event, true)} onLostPointerCapture={event => end(event, true)} />)}
  </section>;
}
