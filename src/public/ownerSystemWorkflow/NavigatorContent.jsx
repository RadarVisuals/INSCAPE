import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Home } from 'lucide-react';
import './navigator.css';

export function NavigatorHome({ onClick, disabled, label = 'Reset Workbench view' }) {
  return <button type="button" className="workflow-tactile-control navigator-home" aria-label={label}
    title="Return to the starting view at 100%" disabled={disabled} onClick={onClick}><Home size={16} strokeWidth={1.6} /></button>;
}

// Both the reference and the real camera use this pointer/keyboard contract.
// The camera can paint just the view frame without rendering the miniature.
export const NavigatorMap = forwardRef(function NavigatorMap({ view, frameSize, children, onViewChange,
  onBegin, onEnd, readView, disabled = false, label = 'Navigate Workbench', className = '', clamp = value => Math.max(0, Math.min(100, value)) }, ref) {
  const node = useRef(null), frame = useRef(null), drag = useRef(null), latest = useRef(null);
  const [dragging, setDragging] = useState(false);
  latest.current = { view, onViewChange, onBegin, onEnd, readView, clamp, disabled };
  const paint = ({ view, frameSize }) => {
    if (!frame.current) return;
    Object.assign(frame.current.style, { left: `${view.x}%`, top: `${view.y}%`, width: `${frameSize.width}%`, height: `${frameSize.height}%` });
  };
  const finish = cancelled => {
    const active = drag.current;
    if (!active) return;
    drag.current = null; setDragging(false);
    // A gesture owner restores its authoritative camera on cancellation. The
    // standalone reference has no owner and restores its example centre here.
    if (cancelled && !latest.current.onEnd) latest.current.onViewChange(active.start);
    latest.current.onEnd?.(cancelled);
    if (active.element.hasPointerCapture(active.id)) active.element.releasePointerCapture(active.id);
  };
  useImperativeHandle(ref, () => ({ paint, node: () => node.current, cancel: () => finish(true) }), []);
  useEffect(() => {
    const blur = () => finish(true), visibility = () => { if (document.hidden) finish(true); };
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); finish(true); };
  }, []);
  useEffect(() => { if (disabled) finish(true); }, [disabled]);
  const point = event => {
    const rect = node.current.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * 100, y: (event.clientY - rect.top) / rect.height * 100 };
  };
  const move = event => {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    active.moved = true;
    const p = point(event), limit = latest.current.clamp;
    latest.current.onViewChange({ x: limit(p.x + active.offset.x), y: limit(p.y + active.offset.y) });
  };
  return <div ref={node} role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled || undefined}
    className={`navigator-map ${className}`} aria-label={label} title="Drag to pan. Use arrow keys to move."
    data-dragging={dragging || undefined}
    onBlur={event => { delete event.currentTarget.dataset.pointerFocus; finish(true); }}
    onPointerDown={event => {
      if (latest.current.disabled || event.button !== 0 || !event.isPrimary || drag.current) return;
      event.preventDefault(); event.stopPropagation(); event.currentTarget.dataset.pointerFocus = "true";
      if (latest.current.onBegin?.() === false) return;
      const start = latest.current.readView?.() || latest.current.view, p = point(event), rect = frame.current.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      drag.current = { id: event.pointerId, element: event.currentTarget, start,
        offset: inside ? { x: start.x - p.x, y: start.y - p.y } : { x: 0, y: 0 } };
      event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true); if (!inside) move(event);
    }} onPointerMove={event => { if (drag.current?.id === event.pointerId) { if (!(event.buttons & 1)) finish(false); else move(event); } }}
    onPointerUp={event => { if (drag.current?.id === event.pointerId) { if (drag.current.moved) move(event); finish(false); } }}
    onPointerCancel={event => { if (drag.current?.id === event.pointerId) finish(true); }}
    onLostPointerCapture={event => { if (drag.current?.id === event.pointerId) finish(true); }}
    onKeyDown={event => {
      delete event.currentTarget.dataset.pointerFocus;
      if (event.key === 'Escape' && drag.current) { event.preventDefault(); event.stopPropagation(); finish(true); }
      else if (!disabled && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation(); finish(false);
        if (latest.current.onBegin?.() === false) return;
        const v = latest.current.readView?.() || latest.current.view, limit = latest.current.clamp;
        latest.current.onViewChange({ x: limit(v.x + (event.key === 'ArrowLeft' ? -5 : event.key === 'ArrowRight' ? 5 : 0)),
          y: limit(v.y + (event.key === 'ArrowUp' ? -5 : event.key === 'ArrowDown' ? 5 : 0)) });
        latest.current.onEnd?.(false);
      }
    }}>
    <div className="navigator-miniature" aria-hidden="true" inert="">{children}</div>
    <span ref={frame} className="navigator-map-view ds-studio-map-view" style={{ left: `${view.x}%`, top: `${view.y}%`, width: `${frameSize.width}%`, height: `${frameSize.height}%` }} />
  </div>;
});

export const NavigatorZoom = forwardRef(function NavigatorZoom({ zoom, onChange, disabled, label = 'Workbench zoom' }, ref) {
  const input = useRef(null), output = useRef(null);
  useEffect(() => { if (input.current) input.current.value = String(zoom); }, [zoom]);
  useImperativeHandle(ref, () => ({ paint(value) {
    if (input.current) input.current.value = String(value);
    if (output.current) output.current.textContent = `${Math.round(value)}%`;
  } }), []);
  return <label className="navigator-zoom"><span>Zoom</span><input ref={input} aria-label={label} type="range" min="25" max="200" step="1"
    disabled={disabled} defaultValue={zoom} onChange={event => onChange(Number(event.target.value))} /><output ref={output}>{Math.round(zoom)}%</output></label>;
});
