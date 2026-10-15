import React, { useEffect, useRef, useState } from 'react';
// Temporary camera input only. Pointer capture and cancellation belong to this instrument.
export default function NavigatorMap({ view, zoom, onViewChange }) {
  const drag = useRef(null),
    frameRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const clamp = (value) => Math.max(10, Math.min(90, value));
  const pointerPosition = (event, element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  };
  const finish = (cancelled) => {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    setDragging(false);
    if (cancelled) onViewChange(active.start);
    if (active.element.hasPointerCapture(active.pointerId))
      active.element.releasePointerCapture(active.pointerId);
  };
  useEffect(() => {
    const blur = () => finish(true);
    const visibility = () => {
      if (document.hidden) finish(true);
    };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      const active = drag.current;
      drag.current = null;
      if (active?.element.hasPointerCapture(active.pointerId))
        active.element.releasePointerCapture(active.pointerId);
    };
  }, [onViewChange]);
  const move = (event) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const point = pointerPosition(event, active.element);
    onViewChange({ x: clamp(point.x + active.offset.x), y: clamp(point.y + active.offset.y) });
  };
  return (
    <button
      type="button"
      className="ds-studio-map"
      aria-label="Navigate example workbench"
      title="Drag to pan. Use arrow keys to move."
      data-dragging={dragging || undefined}
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary || drag.current) return;
        event.preventDefault();
        const element = event.currentTarget,
          point = pointerPosition(event, element),
          frame = frameRef.current.getBoundingClientRect();
        const inside =
          event.clientX >= frame.left &&
          event.clientX <= frame.right &&
          event.clientY >= frame.top &&
          event.clientY <= frame.bottom;
        drag.current = {
          pointerId: event.pointerId,
          element,
          start: view,
          offset: inside ? { x: view.x - point.x, y: view.y - point.y } : { x: 0, y: 0 },
        };
        element.focus({ preventScroll: true });
        element.setPointerCapture(event.pointerId);
        setDragging(true);
        move(event);
      }}
      onPointerMove={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        if (!(event.buttons & 1)) {
          finish(false);
          return;
        }
        move(event);
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointerId === event.pointerId) {
          move(event);
          finish(false);
        }
      }}
      onPointerCancel={(event) => {
        if (drag.current?.pointerId === event.pointerId) finish(true);
      }}
      onLostPointerCapture={(event) => {
        if (drag.current?.pointerId === event.pointerId) finish(true);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && drag.current) {
          event.preventDefault();
          finish(true);
        } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault();
          finish(false);
          onViewChange((v) => ({
            x: clamp(v.x + (event.key === 'ArrowLeft' ? -5 : event.key === 'ArrowRight' ? 5 : 0)),
            y: clamp(v.y + (event.key === 'ArrowUp' ? -5 : event.key === 'ArrowDown' ? 5 : 0)),
          }));
        }
      }}
    >
      <span className="ds-studio-map-art" />
      <span
        ref={frameRef}
        className="ds-studio-map-view"
        style={{
          width: `${Math.min(85, (45 * 100) / zoom)}%`,
          height: `${Math.min(85, (45 * 100) / zoom)}%`,
          left: `${view.x}%`,
          top: `${view.y}%`,
        }}
      />
    </button>
  );
}
