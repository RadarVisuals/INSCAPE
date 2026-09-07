import { useLayoutEffect, useRef, useState } from 'react';
import { PanelRightClose, X } from 'lucide-react';
import OwnerSystemWorkflowDetachedWindow from './OwnerSystemWorkflowDetachedWindow.jsx';

// View-only window behavior. The caller supplies its content and commands.
export function WorkbenchWindow({ children, label, controls, title, titleContent, width = 320, initialHeight = 420, preferredHeight, initialX = 18 }) {
  const node = useRef(null);
  const gesture = useRef(null);
  const resize = useRef(null);
  const [position, setPosition] = useState(() => ({
    x: initialX, y: 72,
  }));
  const [height, setHeight] = useState(initialHeight);
  useLayoutEffect(() => {
    if (Number.isFinite(preferredHeight)) setHeight(Math.max(180, Math.min(globalThis.innerHeight - position.y - 54, preferredHeight)));
  }, [preferredHeight]);
  const clamp = (value) => ({
    x: Math.max(8, Math.min(globalThis.innerWidth - (node.current?.offsetWidth || 300) - 8, value.x)),
    y: Math.max(8, Math.min(globalThis.innerHeight - (node.current?.offsetHeight || height) - 54, value.y)),
  });
  useLayoutEffect(() => {
    const update = () => setPosition((current) => {
      const next = clamp(current);
      return next.x === current.x && next.y === current.y ? current : next;
    });
    const observer = new ResizeObserver(update);
    if (node.current) observer.observe(node.current);
    globalThis.addEventListener('resize', update);
    update();
    return () => { observer.disconnect(); globalThis.removeEventListener('resize', update); };
  }, []);
  const start = (event) => {
    if (event.button !== 0 || event.target.closest('button, a')) return;
    event.preventDefault();
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, position };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event) => {
    const origin = gesture.current;
    if (origin?.id !== event.pointerId) return;
    setPosition(clamp({ x: origin.position.x + event.clientX - origin.x,
      y: origin.position.y + event.clientY - origin.y }));
  };
  const finish = () => { gesture.current = null; };
  const resizeHeight = (value) => setHeight(Math.max(180, Math.min(globalThis.innerHeight - position.y - 54, value)));
  const onKeyDown = (event) => {
    if (event.target !== event.currentTarget || !event.key.startsWith('Arrow')) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 24 : 8;
    setPosition((current) => clamp({ x: current.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
      y: current.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0) }));
  };
  return <OwnerSystemWorkflowDetachedWindow ariaLabel={`${label} — ${title}`} ref={node}
    className="system-workflow__instrument-window" title={`${label} · ${title}`}
    headerPointerProps={{ 'aria-label': `Move ${label} window`, tabIndex: 0, onKeyDown,
      onPointerDown: start, onPointerMove: move, onPointerUp: finish, onPointerCancel: finish }}
    controls={controls} titleContent={titleContent}
    style={{ '--detached-window-width': `${width}px`, left: position.x, top: position.y, height, maxHeight: 'calc(100dvh - 70px)' }}
    resizeHandleProps={{ 'aria-label': `Resize ${label} height`, role: 'separator', tabIndex: 0,
      'aria-orientation': 'horizontal', 'aria-valuenow': Math.round(height),
      onPointerDown: (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        resize.current = { id: event.pointerId, y: event.clientY, height: node.current.offsetHeight };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event) => {
        if (resize.current?.id === event.pointerId) resizeHeight(resize.current.height + event.clientY - resize.current.y);
      },
      onPointerUp: () => { resize.current = null; }, onPointerCancel: () => { resize.current = null; },
      onKeyDown: (event) => {
        if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        resizeHeight(height + (event.key === 'ArrowDown' ? 1 : -1) * (event.shiftKey ? 24 : 8));
      } }}
    surfaceClassName="system-workflow__instrument-content">
    {children}
  </OwnerSystemWorkflowDetachedWindow>;
}

export default function DisplayInstrumentWindow({ children, instrument, onAttach, onClose, title }) {
  const label = instrument === 'layers' ? 'Layers' : 'Metadata';
  return <WorkbenchWindow label={label} title={title}
    initialX={instrument === 'layers' ? 18 : Math.max(8, globalThis.innerWidth - 326)}
    controls={<><button aria-label={`Attach ${label}`} className="system-workflow__round-control" onClick={onAttach}
      type="button"><PanelRightClose /></button><button aria-label={`Close ${label}`} className="system-workflow__round-control"
      onClick={onClose} type="button"><X /></button></>}>
    {children}
  </WorkbenchWindow>;
}
