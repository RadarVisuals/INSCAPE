import { useRef } from 'react';

// Cue and foldout header adjust the same temporary anchor, in Display coordinates.
export default function useDisplayCueGesture({ host, bounds, offset, rectangle, editable, onMove, onReset, onActivate }) {
  const drag = useRef(null);
  const suppressClick = useRef(false);
  return {
    onClick: () => {
      if (suppressClick.current) { suppressClick.current = false; return; }
      onActivate?.();
    },
    onPointerDown: event => {
      suppressClick.current = false;
      if (!editable || event.button !== 0 || !rectangle?.width || !rectangle?.height) return;
      drag.current = { startX: event.clientX, startY: event.clientY, offset, rectangle, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: event => {
      const current = drag.current;
      if (!editable || !current) return;
      const measured = host.getBoundingClientRect();
      if (!measured.width || !measured.height) return;
      const dx = (event.clientX - current.startX) * bounds.width / measured.width;
      const dy = (event.clientY - current.startY) * bounds.height / measured.height;
      if (!current.moved && Math.hypot(dx, dy) < 4) return;
      current.moved = true; suppressClick.current = true;
      onMove({ x: current.offset.x + dx / current.rectangle.width,
        y: current.offset.y + dy / current.rectangle.height });
    },
    onPointerUp: () => { drag.current = null; },
    onPointerCancel: () => {
      if (drag.current) onMove(drag.current.offset);
      drag.current = null; suppressClick.current = true;
    },
    onLostPointerCapture: () => { drag.current = null; },
    onKeyDown: event => {
      if (['Enter', ' '].includes(event.key)) suppressClick.current = false;
      if (!editable || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      if (event.key === 'Home') { onReset(); return; }
      const step = event.shiftKey ? .1 : .02;
      onMove({ x: offset.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
        y: offset.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) });
    },
  };
}
