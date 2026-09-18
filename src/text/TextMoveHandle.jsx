import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Move } from 'lucide-react';

export default function TextMoveHandle({ label, disabled, previewAt, onDrop, onKeyboardMove, onError }) {
  const gesture = useRef(null), [preview, setPreview] = useState(null);
  const cancel = () => {
    const drag = gesture.current;
    if (drag) drag.node.style.pointerEvents = drag.pointerEvents;
    gesture.current = null; setPreview(null);
  };
  useEffect(() => {
    const escape = event => { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel(); } };
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('keydown', escape, true); if (gesture.current) gesture.current.node.style.pointerEvents = gesture.current.pointerEvents; };
  }, []);
  return <><button type="button" className="system-workflow__round-control text-move-handle" aria-label={label} title={label} disabled={disabled}
    onClick={event => { if (event.detail === 0) onKeyboardMove?.(); }}
    onPointerDown={event => {
      if (event.button !== 0 || disabled) return;
      event.preventDefault(); event.stopPropagation();
      const node = event.currentTarget.closest('.text-window, .system-workflow__placement');
      if (!node) return;
      const rectangle = node.getBoundingClientRect();
      gesture.current = { node, rectangle, pointerEvents: node.style.pointerEvents, x: event.clientX, y: event.clientY, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const drag = gesture.current; if (!drag) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true; drag.node.style.pointerEvents = 'none';
      const rectangle = { left: drag.rectangle.left + dx, top: drag.rectangle.top + dy, width: drag.rectangle.width, height: drag.rectangle.height };
      const point = { x: event.clientX, y: event.clientY };
      const target = previewAt(point, rectangle);
      drag.drop = { target, rectangle, point };
      setPreview({ rectangle: target?.rectangle || rectangle, label: target?.label || 'Drop on an unlocked Display to attach' });
    }}
    onPointerUp={event => {
      event.stopPropagation(); if (!gesture.current) return;
      const drop = gesture.current.drop; cancel();
      if (!drop) { onKeyboardMove?.(); return; }
      try { onDrop(drop.target, drop.rectangle, drop.point); } catch (error) { onError?.(error.message); }
    }} onPointerCancel={cancel} onLostPointerCapture={() => { if (gesture.current) cancel(); }}><Move /></button>
    {preview && createPortal(<div className="text-transfer-preview" style={{ left: preview.rectangle.left, top: preview.rectangle.top, width: preview.rectangle.width, height: preview.rectangle.height }}>
      <span role="status">{preview.label}</span>
    </div>, document.body)}
  </>;
}
