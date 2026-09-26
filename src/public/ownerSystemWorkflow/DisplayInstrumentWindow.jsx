import { useWorkbenchPlacement } from './WorkbenchPlacement.jsx';
import { useWorkbenchView, workbenchModuleTransform, useWorkbenchViewRegistration } from './WorkbenchView.jsx';
import { workbenchViewStyle } from './workbenchViewScale.js';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import OwnerSystemWorkflowDetachedWindow from './OwnerSystemWorkflowDetachedWindow.jsx';
import { snapWorkbenchCoordinate, WORKBENCH_GRID_STEP } from './workbenchGrid.js';
import { clampWorkbenchPosition, WORKBENCH_BOUNDS } from './workbenchSpace.js';
import { clampOwnerSystemWorkflowWindowPosition } from './ownerSystemWorkflowWindowGeometry.js';

// View-only window behavior. The caller supplies its content and commands.
export function WorkbenchWindow({ children, background, compact, chrome, menuSurface, className = '', label, controls, title, titleContent, width = 320, resizable = true, resizableWidth = false, initialHeight = 420, minimumHeight = 180, minimumWidth = 240, controlledSize, onResizeEnd, preferredHeight, initialX = 18, initialY = 72, fitContent = false, onLayoutChange, snapToGrid = false, placementModule = false, viewId, surfaceStyle, resizeTarget, committedFrame }) {
  const view = useWorkbenchView();
  const { offset } = useWorkbenchCamera();
  const viewTransform = viewId && !compact ? workbenchModuleTransform(view, viewId) : { scale: 1, x: 0, y: 0 };
  const viewScale = viewTransform.scale;
  const node = useRef(null);
  const placement = useWorkbenchPlacement(node, placementModule && !compact, viewScale);
  const measuredContent = useRef(null);
  const gesture = useRef(null);
  const resize = useRef(null);
  const [storedPosition, setPosition] = useState(() => ({
    x: initialX, y: initialY,
  }));
  const [storedHeight, setHeight] = useState(initialHeight);
  const [resizedWidth, setResizedWidth] = useState(width);
  const previewFrame = viewTransform.frame;
  const position = previewFrame ? { x: previewFrame.left, y: previewFrame.top } : storedPosition;
  const height = previewFrame?.height ?? storedHeight;
  const windowWidth = previewFrame?.width ?? (resizableWidth ? resizedWidth : width);
  useLayoutEffect(() => {
    if (!committedFrame) return;
    setPosition({ x: committedFrame.left, y: committedFrame.top });
    setResizedWidth(committedFrame.width); setHeight(committedFrame.height);
  }, [committedFrame]);
  // Companion tools live in screen coordinates, not in the large composition
  // area. Recover an offscreen saved position and keep their controls reachable.
  useLayoutEffect(() => {
    if (viewId || compact) return undefined;
    const keepVisible = () => {
      const bounds = node.current?.getBoundingClientRect();
      if (!bounds) return;
      setPosition(current => {
        const next = clampOwnerSystemWorkflowWindowPosition(current, bounds,
          { width: globalThis.innerWidth, height: globalThis.innerHeight - 48 });
        return next.x === current.x && next.y === current.y ? current : next;
      });
    };
    keepVisible();
    globalThis.addEventListener('resize', keepVisible);
    return () => globalThis.removeEventListener('resize', keepVisible);
  }, [viewId, Boolean(compact), windowWidth, height]);
  useLayoutEffect(() => {
    if (controlledSize) { setResizedWidth(controlledSize.width); setHeight(controlledSize.height); }
  }, [controlledSize?.width, controlledSize?.height]);
  const finishResize = (cancelled = false) => {
    if (!resize.current) return;
    resize.current = null; placement.finish();
    if (cancelled || onResizeEnd?.({ width: windowWidth, height }) === false) {
      if (controlledSize) { setResizedWidth(controlledSize.width); setHeight(controlledSize.height); }
    }
  };
  useWorkbenchViewRegistration(viewId, node, !compact, { left: position.x, top: position.y, width: windowWidth, height }, resizeTarget);
  useLayoutEffect(() => {
    if (!compact && !previewFrame) onLayoutChange?.({ left: position.x, top: position.y, width: windowWidth, height });
  }, [position.x, position.y, windowWidth, height, onLayoutChange, Boolean(compact), previewFrame]);
  useLayoutEffect(() => {
    if (!fitContent && Number.isFinite(preferredHeight)) setHeight(Math.max(180, Math.min(WORKBENCH_BOUNDS.bottom - position.y, preferredHeight)));
  }, [preferredHeight, fitContent]);
  useLayoutEffect(() => {
    if (!fitContent || compact) return undefined;
    const content = measuredContent.current;
    const measure = () => {
      const surfaceStyle = getComputedStyle(content.parentElement);
      const chromeHeight = node.current.offsetHeight - content.parentElement.clientHeight
        + parseFloat(surfaceStyle.paddingTop) + parseFloat(surfaceStyle.paddingBottom);
      setHeight(Math.max(minimumHeight, Math.min(globalThis.innerHeight - 70,
        Math.ceil(content.getBoundingClientRect().height + chromeHeight))));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    globalThis.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); globalThis.removeEventListener('resize', measure); };
  }, [fitContent, position.y, Boolean(compact), minimumHeight]);
  // Restore saved positions verbatim, including older outlying layouts. Only
  // an explicit movement applies the current placement boundary.
  const clamp = value => {
    if (!viewId) return clampOwnerSystemWorkflowWindowPosition(value,
      node.current?.getBoundingClientRect() || { width: windowWidth, height },
      { width: globalThis.innerWidth, height: globalThis.innerHeight - 48 });
    const next = clampWorkbenchPosition({ left: value.x, top: value.y }, { width: windowWidth, height });
    return { x: next.left, y: next.top };
  };
  const placed = (candidate, current, snapping, bypass) => {
    const next = placement.position({ left: candidate.x, top: candidate.y }, { left: current.x, top: current.y },
      { left: snapWorkbenchCoordinate(candidate.x, snapping), top: snapWorkbenchCoordinate(candidate.y, snapping) }, bypass);
    return clamp({ x: next.left, y: next.top });
  };
  const start = (event) => {
    if (event.button !== 0 || event.target.closest('button, a')) return;
    event.preventDefault();
    placement.begin(event);
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, position };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event) => {
    const origin = gesture.current;
    if (origin?.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 3) return;
    const snapping = snapToGrid && !event.altKey;
    setPosition(placed({ x: origin.position.x + (event.clientX - origin.x) / viewScale, y: origin.position.y + (event.clientY - origin.y) / viewScale }, position, snapping, event.altKey));
  };
  const finish = () => { gesture.current = null; placement.finish(); };
  const resizeHeight = (value, altKey) => setHeight(Math.max(minimumHeight, Math.min(WORKBENCH_BOUNDS.bottom - position.y,
    (placement.edge('y', 'bottom', position.y + value, { left: position.x, top: position.y }, altKey) ?? snapWorkbenchCoordinate(position.y + value, snapToGrid && !altKey)) - position.y)));
  const resizeWidth = (value, altKey) => setResizedWidth(Math.max(minimumWidth, Math.min(WORKBENCH_BOUNDS.right - position.x,
    (placement.edge('x', 'right', position.x + value, { left: position.x, top: position.y }, altKey) ?? snapWorkbenchCoordinate(position.x + value, snapToGrid && !altKey)) - position.x)));
  const onKeyDown = (event) => {
    if (event.target !== event.currentTarget || !event.key.startsWith('Arrow')) return;
    event.preventDefault(); event.stopPropagation();
    placement.begin(event);
    const snapping = snapToGrid && !event.altKey;
    const step = snapping || event.shiftKey ? WORKBENCH_GRID_STEP : 8;
    setPosition((current) => placed({ x: current.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
      y: current.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0) }, current, snapping, event.altKey));
  };
  return <OwnerSystemWorkflowDetachedWindow ariaLabel={`${label} — ${title}`} ref={node} viewId={viewId} workbenchPan={Boolean(viewId) && !compact}
    className={`system-workflow__instrument-window ${className}`} title={`${label} · ${title}`}
    headerPointerProps={{ 'aria-label': `Move ${label} window`, 'data-workbench-selectable': viewId ? true : undefined, 'aria-keyshortcuts': viewId ? 'Shift+Enter' : undefined, tabIndex: 0, onKeyDown,
      onPointerDown: start, onPointerMove: move, onPointerUp: finish, onPointerCancel: finish, onLostPointerCapture: finish }}
    controls={controls} titleContent={titleContent} background={background} compactContent={compact?.content} chrome={chrome} menuSurface={menuSurface}
    style={{ ...surfaceStyle, '--workbench-pan-scale': viewScale, '--detached-window-width': `${windowWidth}px`, left: position.x, top: position.y, height, maxHeight: viewId ? 'none' : 'calc(100dvh - 64px)', ...(viewId && !compact ? workbenchViewStyle(viewScale, position.x, position.y, windowWidth, height, viewTransform.x, viewTransform.y, offset) : {}), ...compact?.style }}
    resizeHandleProps={!resizable || fitContent || compact ? undefined : { 'aria-label': `Resize ${label} ${resizableWidth ? 'window' : 'height'}`, role: 'separator', tabIndex: 0,
      ...(resizableWidth ? { style: { cursor: 'nwse-resize' }, 'aria-valuetext': `${Math.round(windowWidth)} by ${Math.round(height)} pixels` } : {}),
      'aria-orientation': 'horizontal', 'aria-valuenow': Math.round(height),
      onPointerDown: (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        placement.begin(event);
        resize.current = { id: event.pointerId, x: event.clientX, y: event.clientY, width: node.current.offsetWidth, height: node.current.offsetHeight };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event) => {
        if (resize.current?.id === event.pointerId) {
          resizeHeight(resize.current.height + (event.clientY - resize.current.y) / viewScale, event.altKey);
          if (resizableWidth) resizeWidth(resize.current.width + (event.clientX - resize.current.x) / viewScale, event.altKey);
        }
      },
      onPointerUp: () => finishResize(), onPointerCancel: () => finishResize(true),
      onLostPointerCapture: () => finishResize(true),
      onKeyUp: event => { if (event.key.startsWith('Arrow')) onResizeEnd?.({ width: windowWidth, height }); },
      onKeyDown: (event) => {
        if (event.key.startsWith('Arrow')) placement.begin(event);
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
  const label = instrument === 'layers' ? 'Layers' : 'Artwork info';
  return <WorkbenchWindow chrome="bevel" menuSurface={menuSurface} label={label} title={title}
    width={layout?.width || 320} resizableWidth initialHeight={layout?.height || 480}
    initialX={layout?.left ?? (instrument === 'metadata' ? 18 : Math.max(8, globalThis.innerWidth - 340))} initialY={layout?.top ?? 72}
    onLayoutChange={onLayoutChange}
    controls={<button aria-label={`Close ${label}`} className="system-workflow__window-cap"
      onClick={onClose} type="button"><X /></button>}>
    <div onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); onClose(); } }}>{children}</div>
  </WorkbenchWindow>;
}
