import { useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useWorkbenchPlacement } from './WorkbenchPlacement.jsx';
import { useWorkbenchView, workbenchModuleTransform, useWorkbenchViewRegistration } from './WorkbenchView.jsx';
import { workbenchViewStyle } from './workbenchViewScale.js';
import { workbenchPaintGeometry } from './workbenchPaintGeometry.js';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import OwnerSystemWorkflowDetachedWindow from './OwnerSystemWorkflowDetachedWindow.jsx';
import { snapWorkbenchCoordinate, WORKBENCH_GRID_STEP } from './workbenchGrid.js';
import { clampWorkbenchPosition, WORKBENCH_BOUNDS } from './workbenchSpace.js';
import { clampOwnerSystemWorkflowWindowPosition, resizeWorkbenchWindow, workbenchResizeControl, WORKBENCH_RESIZE_EDGES } from './ownerSystemWorkflowWindowGeometry.js';

// The host owns gestures and temporary geometry. A module's resize target owns
// validation and persistence; companion tools retain only their screen layout.
export function WorkbenchWindow({ children, background, compact, chrome, menuSurface, className = '', label, controls, title, titleContent, width = 320, resizable = true, resizableWidth = false, initialHeight = 420, minimumHeight = 180, minimumWidth = 240, initialX = 18, initialY = 72, fitContent = false, onLayoutChange, snapToGrid = false, placementModule = false, viewId, active, surfaceStyle, resizeTarget, committedFrame, externalControls = false, moveFromContent = false }) {
  const view = useWorkbenchView();
  const { offset } = useWorkbenchCamera();
  const transformed = Boolean(viewId) && !compact;
  const camera = transformed ? workbenchModuleTransform(view, viewId) : { scale: 1, x: 0, y: 0 };
  const node = useRef(null), measuredContent = useRef(null), gesture = useRef(null), latest = useRef(null);
  const [frame, setFrame] = useState(() => ({ left: initialX, top: initialY, width, height: initialHeight }));
  const [preview, setPreview] = useState(null);
  const [viewport, setViewport] = useState(() => ({ width: globalThis.innerWidth, height: globalThis.innerHeight }));
  const base = { ...frame, width: resizableWidth ? frame.width : width };
  if (!viewId && !compact) {
    if (resizableWidth) base.width = Math.min(base.width, viewport.width - 16);
    base.height = Math.min(base.height, viewport.height - 64);
  }
  const current = camera.frame || preview || base;
  const density = transformed ? globalThis.devicePixelRatio || 1 : 1;
  const screen = transformed ? { left: current.left * camera.scale + camera.x + offset.x,
    top: current.top * camera.scale + camera.y + offset.y, width: current.width * camera.scale, height: current.height * camera.scale }
    : { ...current, width: Math.min(current.width, viewport.width - 16) };
  const paint = workbenchPaintGeometry(screen, density);
  const painted = Object.fromEntries(Object.entries(paint).map(([key, value]) => [key, value / density]));
  const placement = useWorkbenchPlacement(node, placementModule && !compact, camera.scale, true, screen);
  useWorkbenchViewRegistration(viewId, node, !compact, base, resizeTarget,
    position => setFrame(current => ({ ...current, ...position })));
  const canResize = resizable && !fitContent && !compact && (!resizeTarget?.store || resizeTarget.enabled);
  const local = transformed ? view.transforms[viewId] : null;
  const localScale = local?.scale || 1;
  const bounds = viewId ? {
    left: (WORKBENCH_BOUNDS.left - (local?.x || 0)) / localScale,
    top: (WORKBENCH_BOUNDS.top - (local?.y || 0)) / localScale,
    right: (WORKBENCH_BOUNDS.right - (local?.x || 0)) / localScale,
    bottom: (WORKBENCH_BOUNDS.bottom - (local?.y || 0)) / localScale,
  } : { left: 8, top: 8, right: viewport.width - 8, bottom: viewport.height - 56 };
  const commitResize = next => {
    if (resizeTarget?.store) {
      if (!resizeTarget.enabled) return false;
      const authored = { left: next.left * localScale + (local?.x || 0), top: next.top * localScale + (local?.y || 0),
        width: next.width * localScale, height: next.height * localScale };
      if (!resizeTarget.commit([{ ...resizeTarget, id: viewId, ...authored, getPresentation: view.getPresentation }])) return false;
      view.setTransforms(values => { const nextTransforms = { ...values }; delete nextTransforms[viewId]; return nextTransforms; });
      resizeTarget.applyFrame(authored);
      setFrame(authored);
    } else setFrame(next);
    return true;
  };
  const finish = (cancelled = false) => {
    const drag = gesture.current;
    if (!drag) return;
    gesture.current = null;
    placement.finish();
    if (drag.kind === 'resize') {
      if (!cancelled && drag.next) commitResize(drag.next);
      setPreview(null);
    } else if (drag.kind === 'content-move') {
      if (!cancelled && drag.next) setFrame(drag.next);
      setPreview(null);
    } else if (cancelled) setFrame(drag.frame);
    if (drag.element.hasPointerCapture?.(drag.id)) drag.element.releasePointerCapture(drag.id);
    if (!drag.element.isConnected) queueMicrotask(() => node.current?.querySelector('header')?.focus());
  };
  latest.current = { finish };
  useLayoutEffect(() => {
    const cancel = () => latest.current.finish(true);
    const escape = event => {
      if (event.key !== 'Escape' || !gesture.current) return;
      event.preventDefault(); event.stopPropagation(); cancel();
    };
    const resize = () => { cancel(); setViewport({ width: globalThis.innerWidth, height: globalThis.innerHeight }); };
    document.addEventListener('keydown', escape, true);
    globalThis.addEventListener('blur', cancel);
    globalThis.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('keydown', escape, true);
      globalThis.removeEventListener('blur', cancel);
      globalThis.removeEventListener('resize', resize);
      cancel();
    };
  }, []);
  useLayoutEffect(() => { latest.current.finish(true); }, [camera.scale, camera.x, camera.y, offset.x, offset.y, Boolean(compact), canResize, moveFromContent, resizeTarget?.expected]);
  useLayoutEffect(() => { if (committedFrame) setFrame(committedFrame); }, [committedFrame]);
  // Tools belong to the viewport. Authored module positions remain in Workbench
  // coordinates and are never rewritten just because the browser got smaller.
  useLayoutEffect(() => {
    if (viewId || compact || preview) return;
    const position = clampOwnerSystemWorkflowWindowPosition({ x: base.left, y: base.top }, base,
      { width: viewport.width, height: viewport.height - 48 });
    if (position.x !== frame.left || position.y !== frame.top || base.width !== frame.width || base.height !== frame.height)
      setFrame({ ...base, left: position.x, top: position.y });
  }, [viewId, Boolean(compact), Boolean(preview), frame.left, frame.top, base.width, base.height, viewport.width, viewport.height]);
  useLayoutEffect(() => {
    if (!compact && !camera.frame) onLayoutChange?.(base);
  }, [base.left, base.top, base.width, base.height, onLayoutChange, Boolean(compact), camera.frame]);
  useLayoutEffect(() => {
    if (!fitContent || compact) return undefined;
    const content = measuredContent.current;
    const measure = () => {
      const style = getComputedStyle(content.parentElement);
      const chromeHeight = node.current.offsetHeight - content.parentElement.clientHeight
        + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const height = Math.max(minimumHeight, Math.min(globalThis.innerHeight - 70,
        Math.ceil(content.getBoundingClientRect().height + chromeHeight)));
      setFrame(value => value.height === height ? value : { ...value, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content); globalThis.addEventListener('resize', measure); measure();
    return () => { observer.disconnect(); globalThis.removeEventListener('resize', measure); };
  }, [fitContent, Boolean(compact), minimumHeight]);
  const positionFor = (candidate, altKey) => {
    const snapping = snapToGrid && !altKey;
    const placed = placement.position(candidate, current, {
      left: snapWorkbenchCoordinate(candidate.left, snapping), top: snapWorkbenchCoordinate(candidate.top, snapping),
    }, altKey);
    if (viewId) return { ...base, ...clampWorkbenchPosition(placed, base) };
    const position = clampOwnerSystemWorkflowWindowPosition({ x: placed.left, y: placed.top }, base,
      { width: viewport.width, height: viewport.height - 48 });
    return { ...base, left: position.x, top: position.y };
  };
  const moveTo = (candidate, altKey) => setFrame(positionFor(candidate, altKey));
  const resizeTo = (origin, edge, delta, altKey) => resizeWorkbenchWindow(origin, edge, delta,
    { width: minimumWidth, height: minimumHeight }, bounds,
    (axis, side, value) => placement.edge(axis, side, value, current, altKey) ?? snapWorkbenchCoordinate(value, snapToGrid && !altKey));
  const begin = (event, kind, edge) => {
    if (event.button !== 0 || kind !== 'resize' && event.target.closest('button, a, input, select, textarea')) return;
    event.preventDefault(); event.stopPropagation();
    if (kind === 'content-move') node.current.querySelector('header')?.focus({ preventScroll: true });
    else event.currentTarget.focus();
    placement.begin(event);
    gesture.current = { kind, edge, id: event.pointerId, x: event.clientX, y: event.clientY, frame: base, element: event.currentTarget };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = event => {
    const drag = gesture.current;
    if (drag?.id !== event.pointerId) return;
    const delta = { x: (event.clientX - drag.x) / camera.scale, y: (event.clientY - drag.y) / camera.scale };
    if (drag.kind === 'content-move') {
      if (!drag.next && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
      drag.next = positionFor({ left: drag.frame.left + delta.x, top: drag.frame.top + delta.y }, event.altKey);
      setPreview(drag.next);
    } else if (drag.kind === 'move') moveTo({ left: drag.frame.left + delta.x, top: drag.frame.top + delta.y }, event.altKey);
    else { drag.next = resizeTo(drag.frame, drag.edge, delta, event.altKey); setPreview(drag.next); }
  };
  const key = (event, edge) => {
    if (event.target !== event.currentTarget || !event.key.startsWith('Arrow')) return;
    event.preventDefault(); event.stopPropagation(); placement.begin(event);
    const step = (snapToGrid && !event.altKey) || event.shiftKey ? WORKBENCH_GRID_STEP : 8;
    const delta = { x: event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0,
      y: event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0 };
    if (edge) commitResize(resizeTo(base, edge, delta, event.altKey));
    else moveTo({ left: base.left + delta.x, top: base.top + delta.y }, event.altKey);
    placement.finish();
  };
  const pointerProps = { onPointerMove: move, onPointerUp: () => finish(), onPointerCancel: () => finish(true), onLostPointerCapture: () => finish(true) };
  return <OwnerSystemWorkflowDetachedWindow ariaLabel={`${label} — ${title}`} ref={node} viewId={viewId} active={active} workbenchPan={Boolean(viewId) && !compact}
    className={`system-workflow__instrument-window ${externalControls ? 'workbench-window--external-controls' : ''} ${className}`} title={`${label} · ${title}`}
    headerPointerProps={{ 'aria-label': `Move ${label} window`, 'data-workbench-selectable': viewId ? true : undefined,
      'data-controls-below': externalControls && painted.top < 56 || undefined, 'aria-keyshortcuts': viewId ? 'Shift+Enter' : undefined,
      tabIndex: 0, onKeyDown: event => key(event), onPointerDown: event => begin(event, 'move'), ...pointerProps }}
    controls={controls} titleContent={titleContent} background={background} compactContent={compact?.content} chrome={chrome} menuSurface={menuSurface}
    contentPointerProps={moveFromContent ? { 'data-content-move': true, 'data-workbench-selectable': Boolean(viewId) || undefined,
      onPointerDown: event => begin(event, 'content-move'), ...pointerProps } : undefined}
    style={{ ...surfaceStyle, '--workbench-pan-scale': camera.scale, '--workbench-control-scale': density, '--detached-window-width': `${current.width}px`,
      left: current.left, top: current.top, height: current.height, maxHeight: viewId ? 'none' : 'calc(100dvh - 64px)',
      ...(transformed ? workbenchViewStyle(camera.scale, current.left, current.top, current.width, current.height, camera.x, camera.y, offset) : {}), ...compact?.style }}
    resizeHandles={canResize && WORKBENCH_RESIZE_EDGES.filter(([edge]) => resizableWidth || ['n', 's'].includes(edge)).map(([edge, name]) =>
      <div key={edge} className={`system-workflow__detached-window-resize is-${edge}`}
        aria-label={edge === 'se' ? `Resize ${label} window` : !resizableWidth && edge === 's' ? `Resize ${label} height` : `Resize ${label} from ${name}`}
        role="separator" tabIndex={0} aria-orientation={['w', 'e'].includes(edge) ? 'vertical' : 'horizontal'}
        aria-valuenow={Math.round(['w', 'e'].includes(edge) ? current.width : current.height)}
        aria-valuetext={`${Math.round(current.width)} by ${Math.round(current.height)} pixels`}
        style={workbenchResizeControl(edge, painted, viewport)} onKeyDown={event => key(event, edge)}
        onPointerDown={event => begin(event, 'resize', edge)} {...pointerProps} />)}
    surfaceClassName="system-workflow__instrument-content">
    {fitContent ? <div ref={measuredContent}>{children}</div> : children}
  </OwnerSystemWorkflowDetachedWindow>;
}

export default function DisplayInstrumentWindow({ menuSurface, children, instrument, onClose, title, layout, onLayoutChange }) {
  const label = instrument === 'layers' ? 'Layers' : instrument === 'appearance' ? 'Display appearance' : 'Artwork info';
  return <WorkbenchWindow chrome="bevel" menuSurface={menuSurface} label={label} title={title}
    width={layout?.width || 320} resizableWidth initialHeight={layout?.height || 480}
    initialX={layout?.left ?? (instrument === 'metadata' ? 18 : Math.max(8, globalThis.innerWidth - 340))} initialY={layout?.top ?? 72}
    onLayoutChange={onLayoutChange}
    controls={<button aria-label={`Close ${label}`} className="system-workflow__window-cap"
      onClick={onClose} type="button"><X /></button>}>
    <div onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); onClose(); } }}>{children}</div>
  </WorkbenchWindow>;
}
