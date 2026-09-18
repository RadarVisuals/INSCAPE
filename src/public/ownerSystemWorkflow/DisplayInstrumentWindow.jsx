import { useWorkbenchPlacement } from './WorkbenchPlacement.jsx';
import { useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import OwnerSystemWorkflowDetachedWindow from './OwnerSystemWorkflowDetachedWindow.jsx';
import { snapWorkbenchCoordinate, WORKBENCH_GRID_STEP } from './workbenchGrid.js';

// View-only window behavior. The caller supplies its content and commands.
export function WorkbenchWindow({ children, background, compact, chrome, menuSurface, className = '', label, controls, title, titleContent, width = 320, resizableWidth = false, initialHeight = 420, preferredHeight, initialX = 18, initialY = 72, fitContent = false, onLayoutChange, snapToGrid = false, placementModule = false, surfaceStyle }) {
  const node = useRef(null);
  const placement = useWorkbenchPlacement(node, placementModule && !compact);
  const measuredContent = useRef(null);
  const gesture = useRef(null);
  const resize = useRef(null);
  const [position, setPosition] = useState(() => ({
    x: initialX, y: initialY,
  }));
  const [height, setHeight] = useState(initialHeight);
  const [resizedWidth, setResizedWidth] = useState(width);
  const windowWidth = resizableWidth ? resizedWidth : width;
  useLayoutEffect(() => {
    if (!compact) onLayoutChange?.({ left: position.x, top: position.y, width: windowWidth, height });
  }, [position.x, position.y, windowWidth, height, onLayoutChange, Boolean(compact)]);
  useLayoutEffect(() => {
    if (!fitContent && Number.isFinite(preferredHeight)) setHeight(Math.max(180, Math.min(globalThis.innerHeight - position.y - 54, preferredHeight)));
  }, [preferredHeight, fitContent]);
  useLayoutEffect(() => {
    if (!fitContent || compact) return undefined;
    const content = measuredContent.current;
    const measure = () => {
      const chromeHeight = node.current.offsetHeight - content.parentElement.clientHeight;
      setHeight(Math.max(180, Math.min(globalThis.innerHeight - position.y - 54,
        Math.ceil(content.getBoundingClientRect().height + chromeHeight))));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    globalThis.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); globalThis.removeEventListener('resize', measure); };
  }, [fitContent, position.y, Boolean(compact)]);
  const clamp = (value) => ({
    x: Math.max(8, Math.min(globalThis.innerWidth - (node.current?.offsetWidth || 300) - 8, value.x)),
    y: Math.max(8, Math.min(globalThis.innerHeight - (node.current?.offsetHeight || height) - 54, value.y)),
  });
  useLayoutEffect(() => {
    if (compact) return undefined;
    const update = () => setPosition((current) => {
      const next = clamp(current);
      return next.x === current.x && next.y === current.y ? current : next;
    });
    const observer = new ResizeObserver(update);
    if (node.current) observer.observe(node.current);
    globalThis.addEventListener('resize', update);
    update();
    return () => { observer.disconnect(); globalThis.removeEventListener('resize', update); };
  }, [Boolean(compact)]);
  const placed = (candidate, current, snapping, bypass) => {
    const next = placement.position({ left: candidate.x, top: candidate.y }, { left: current.x, top: current.y },
      { left: snapWorkbenchCoordinate(candidate.x, snapping), top: snapWorkbenchCoordinate(candidate.y, snapping) }, bypass);
    return clamp({ x: next.left, y: next.top });
  };
  const start = (event) => {
    if (event.button !== 0 || event.target.closest('button, a')) return;
    event.preventDefault();
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, position };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event) => {
    const origin = gesture.current;
    if (origin?.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 3) return;
    const snapping = snapToGrid && !event.altKey;
    setPosition(placed({ x: origin.position.x + event.clientX - origin.x, y: origin.position.y + event.clientY - origin.y }, position, snapping, event.altKey));
  };
  const finish = () => { gesture.current = null; };
  const resizeHeight = (value, altKey) => setHeight(Math.max(180, Math.min(globalThis.innerHeight - position.y - 54,
    (placement.edge('y', 'bottom', position.y + value, { left: position.x, top: position.y }, altKey) ?? snapWorkbenchCoordinate(position.y + value, snapToGrid && !altKey)) - position.y)));
  const resizeWidth = (value, altKey) => setResizedWidth(Math.max(240, Math.min(globalThis.innerWidth - position.x - 8,
    (placement.edge('x', 'right', position.x + value, { left: position.x, top: position.y }, altKey) ?? snapWorkbenchCoordinate(position.x + value, snapToGrid && !altKey)) - position.x)));
  const onKeyDown = (event) => {
    if (event.target !== event.currentTarget || !event.key.startsWith('Arrow')) return;
    event.preventDefault(); event.stopPropagation();
    const snapping = snapToGrid && !event.altKey;
    const step = snapping || event.shiftKey ? WORKBENCH_GRID_STEP : 8;
    setPosition((current) => placed({ x: current.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
      y: current.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0) }, current, snapping, event.altKey));
  };
  return <OwnerSystemWorkflowDetachedWindow ariaLabel={`${label} — ${title}`} ref={node}
    className={`system-workflow__instrument-window ${className}`} title={`${label} · ${title}`}
    headerPointerProps={{ 'aria-label': `Move ${label} window`, tabIndex: 0, onKeyDown,
      onPointerDown: start, onPointerMove: move, onPointerUp: finish, onPointerCancel: finish }}
    controls={controls} titleContent={titleContent} background={background} compactContent={compact?.content} chrome={chrome} menuSurface={menuSurface}
    style={{ ...surfaceStyle, '--detached-window-width': `${windowWidth}px`, left: position.x, top: position.y, height, maxHeight: 'calc(100dvh - 70px)', ...compact?.style }}
    resizeHandleProps={fitContent || compact ? undefined : { 'aria-label': `Resize ${label} ${resizableWidth ? 'window' : 'height'}`, role: 'separator', tabIndex: 0,
      ...(resizableWidth ? { style: { cursor: 'nwse-resize' }, 'aria-valuetext': `${Math.round(windowWidth)} by ${Math.round(height)} pixels` } : {}),
      'aria-orientation': 'horizontal', 'aria-valuenow': Math.round(height),
      onPointerDown: (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        resize.current = { id: event.pointerId, x: event.clientX, y: event.clientY, width: node.current.offsetWidth, height: node.current.offsetHeight };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event) => {
        if (resize.current?.id === event.pointerId) {
          resizeHeight(resize.current.height + event.clientY - resize.current.y, event.altKey);
          if (resizableWidth) resizeWidth(resize.current.width + event.clientX - resize.current.x, event.altKey);
        }
      },
      onPointerUp: () => { resize.current = null; }, onPointerCancel: () => { resize.current = null; },
      onKeyDown: (event) => {
        const step = (snapToGrid && !event.altKey) || event.shiftKey ? WORKBENCH_GRID_STEP : 8;
        if (resizableWidth && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
          event.preventDefault(); event.stopPropagation();
          resizeWidth(windowWidth + (event.key === 'ArrowRight' ? 1 : -1) * step, event.altKey); return;
        }
        if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        resizeHeight(height + (event.key === 'ArrowDown' ? 1 : -1) * step, event.altKey);
      } }}
    surfaceClassName="system-workflow__instrument-content">
    {fitContent ? <div ref={measuredContent}>{children}</div> : children}
  </OwnerSystemWorkflowDetachedWindow>;
}

export default function DisplayInstrumentWindow({ menuSurface, children, instrument, onClose, title, layout, onLayoutChange }) {
  const label = instrument === 'animation' ? 'Animation' : instrument === 'layers' ? 'Layers' : 'Artwork info';
  return <WorkbenchWindow chrome="bevel" menuSurface={menuSurface} label={label} title={title}
    width={layout?.width || 320} resizableWidth initialHeight={layout?.height || (instrument === 'animation' ? 640 : 480)}
    initialX={layout?.left ?? (instrument === 'metadata' ? 18 : Math.max(8, globalThis.innerWidth - (instrument === 'animation' ? 676 : 340)))} initialY={layout?.top ?? 72}
    onLayoutChange={onLayoutChange}
    controls={<button aria-label={`Close ${label}`} className="system-workflow__window-cap"
      onClick={onClose} type="button"><X /></button>}>
    <div onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); onClose(); } }}>{children}</div>
  </WorkbenchWindow>;
}
