import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useWorkbenchView, workbenchModuleTransform, useWorkbenchViewRegistration } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { useWorkbenchPlacement, useWorkbenchMovementSnap } from '../public/ownerSystemWorkflow/WorkbenchPlacement.jsx';
import { imageWindowGeometry, imageWindowPosition, imagePaintGeometry, resizeImageGeometry } from './imageWindowGeometry.js';
import { WORKBENCH_RESIZE_EDGES, workbenchResizeControl } from '../public/ownerSystemWorkflow/ownerSystemWorkflowWindowGeometry.js';
import { useWorkbenchCamera } from '../public/ownerSystemWorkflow/WorkbenchCamera.jsx';
import { clampWorkbenchPosition } from '../public/ownerSystemWorkflow/workbenchSpace.js';

// Image owns a borderless surface. Workbench owns the camera, placement bounds
// and snapping. No instrument-window sizing, chrome or content gutter is used.
export default function ImageWindow({ id, title, position, size, fitScale, fitSize, editable, active, suspended, movable = true, placementModule,
  onPosition, onResize, onClose, resizeTarget, children }) {
  const node = useRef(null), gesture = useRef(null), suppressClick = useRef(false);
  const [preview, setPreview] = useState(null);
  const view = useWorkbenchView();
  const camera = workbenchModuleTransform(view, id);
  if (camera.presented) { editable = false; movable = false; }
  const { offset } = useWorkbenchCamera();
  const snapMovement = useWorkbenchMovementSnap();
  // Authored selection resizing supplies the same whole-pixel frame it will
  // commit. Render that frame so artwork fitting updates during the gesture.
  // Visitor scaling remains a view transform and never changes the fit choice.
  const currentSize = camera.frame || preview?.size || size, currentPosition = camera.frame || preview?.position || position;
  // Camera zoom changes the window's real pixel dimensions. Its content and
  // event handlers only change when the module or authored rectangle changes.
  const content = useMemo(() => children({ left: 0, top: 0, width: currentSize.width, height: currentSize.height }),
    [children, currentSize.width, currentSize.height]);
  const currentFit = fitSize?.(currentSize) ?? fitScale;
  const width = currentSize.width * currentFit, height = currentSize.height * currentFit;
  const density = globalThis.devicePixelRatio || 1;
  const screen = imageWindowGeometry(currentPosition, { width, height }, camera, offset);
  const placement = useWorkbenchPlacement(node, placementModule, camera.scale, true, screen);
  useWorkbenchViewRegistration(id, node, true, { ...position, width: size.width * fitScale, height: size.height * fitScale }, resizeTarget, onPosition);
  const latest = useRef(null);
  latest.current = { onPosition, placement };
  const finish = (cancelled = false) => {
    const active = gesture.current;
    if (!active) return;
    gesture.current = null;
    latest.current.placement.finish();
    suppressClick.current = active.kind === 'move' && (active.dragged || cancelled);
    if (!cancelled && active.next) {
      if (active.kind === 'resize') active.onResize(active.next.size, active.next.position);
      else latest.current.onPosition(active.next.position);
    }
    setPreview(null);
    if (active.target.hasPointerCapture(active.id)) active.target.releasePointerCapture(active.id);
  };
  useEffect(() => {
    const cancel = event => { if (event.type === 'blur' || event.key === 'Escape') finish(true); };
    addEventListener('blur', cancel); addEventListener('keydown', cancel);
    return () => { removeEventListener('blur', cancel); removeEventListener('keydown', cancel); finish(true); };
  }, []);
  useEffect(() => { finish(true); }, [position.left, position.top, size.width, size.height, camera.scale, camera.x, camera.y, offset.x, offset.y, fitScale, suspended, movable, editable, resizeTarget?.expected]);
  const begin = (event, kind, edge) => {
    suppressClick.current = false;
    if (suspended || event.button !== 0 || kind === 'move' && !movable
      || event.target.closest('button:not(.image-module__canvas), a, input, select, textarea')) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true });
    placement.begin(event);
    // Capture on the artwork button itself so a stationary release still
    // produces its native click. A completed drag suppresses that click below.
    const target = event.target.closest('.image-module__canvas') || event.currentTarget;
    gesture.current = { id: event.pointerId, kind, x: event.clientX, y: event.clientY,
      position, size, edge, onResize, target };
    target.setPointerCapture(event.pointerId);
  };
  const placedPosition = (candidate, bypass) => {
    const bounded = clampWorkbenchPosition(candidate, { width, height });
    const projected = imageWindowGeometry(bounded, { width, height }, camera, offset);
    const snapped = placementModule ? snapMovement(projected, [node.current], camera.scale, bypass) : projected;
    return clampWorkbenchPosition(imageWindowPosition(snapped, camera, offset), { width, height });
  };
  const resizeTo = (start, edge, delta, bypass) => resizeImageGeometry(start.position, start.size, fitScale, edge, delta,
    (axis, side, value) => placement.edge(axis, side, value, currentPosition, bypass), fitSize);
  const move = event => {
    const active = gesture.current;
    if (active?.id !== event.pointerId) return;
    event.stopPropagation();
    const dx = (event.clientX - active.x) / camera.scale, dy = (event.clientY - active.y) / camera.scale;
    if (active.kind === 'move') {
      if (!active.dragged && Math.hypot(event.clientX - active.x, event.clientY - active.y) < 5) return;
      active.dragged = true;
      active.next = { size: active.size, position: placedPosition({ left: active.position.left + dx, top: active.position.top + dy }, event.altKey) };
      setPreview(active.next);
    } else {
      active.next = resizeTo(active, active.edge, { x: dx, y: dy }, event.altKey);
      setPreview(active.next);
    }
  };
  const pointer = (kind, edge) => ({ onPointerDown: event => begin(event, kind, edge), onPointerMove: move,
    onPointerUp: () => finish(), onPointerCancel: () => finish(true), onLostPointerCapture: () => finish(true) });
  const key = (event, kind, edge) => {
    if (suspended || kind === 'move' && !movable || event.target !== event.currentTarget || !event.key.startsWith('Arrow')) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 10 : 1;
    const dx = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
    const dy = event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0;
    placement.begin(event);
    if (kind === 'move') onPosition(placedPosition({ left: position.left + dx / camera.scale, top: position.top + dy / camera.scale }, event.altKey));
    else {
      const next = resizeTo({ position, size }, edge, { x: dx * fitScale, y: dy * fitScale }, event.altKey);
      onResize(next.size, next.position);
    }
    placement.finish();
  };
  // Round shared edges once, only for painting. The composited 2D surface maps
  // physical pixels to CSS pixels without a second fractional layout rounding.
  const paint = imagePaintGeometry(screen, density);
  // Tiny or thin canvases must remain available for direct dragging. Put their
  // two action targets outside, beyond the screen-sized resize handles.
  const outsideControls = screen.width < 80 || screen.height < 80;
  const controlsAbove = screen.top + screen.height + 56 > innerHeight && screen.top >= 56;
  const controlsTop = controlsAbove ? -56 : paint.height / density + 28;
  const controlsLeft = Math.max(0, Math.min(innerWidth - 56, paint.left / density)) - paint.left / density;
  return <section ref={node} className="image-module__window" aria-label={`Image — ${title}`} data-workbench-view-id={id}
    data-workbench-selectable={movable && !suspended || undefined} tabIndex={0} aria-keyshortcuts="Shift+Enter"
    aria-description="Click artwork to inspect. Drag to move. Arrow keys move the window; Shift+Enter toggles Workbench selection."
    {...pointer('move')} onKeyDown={event => key(event, 'move')}
    onClickCapture={event => { if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; event.preventDefault(); event.stopPropagation(); } }}
    data-moving={gesture.current?.dragged || undefined}
    data-controls-outside={outsideControls || undefined}
    data-editable={editable || undefined} data-active={active || undefined} data-suspended={suspended || undefined}
    style={{ '--image-density': density, '--image-controls-left': `${controlsLeft}px`, '--image-controls-top': `${controlsTop}px`,
      '--image-controls-bridge': `${controlsTop + (controlsAbove ? 28 : -28)}px`, left: 0, top: 0, width: paint.width, height: paint.height,
      transformOrigin: '0 0', transform: `matrix(${1 / density},0,0,${1 / density},${paint.left / density},${paint.top / density})` }}>
    {content}
    {editable && <div className="image-module__bounds" aria-hidden="true" />}
    <button type="button" className="image-module__close" aria-label={`Close ${title}`} title="Close Image" onClick={onClose}><X size={14} /></button>
    {editable && WORKBENCH_RESIZE_EDGES.filter(([edge]) => gesture.current?.edge === edge || (edge.length === 2
      ? !edge.includes('w') || screen.width >= 56
      : (edge === 'n' || edge === 's' ? screen.width : screen.height) >= 56)).map(([edge, label]) =>
      <div key={edge} className={`image-module__resize is-${edge}`} role="separator"
        style={workbenchResizeControl(edge, { left: paint.left / density, top: paint.top / density, width: paint.width / density, height: paint.height / density }, { width: innerWidth, height: innerHeight })}
        aria-label={label ? `Resize Image ${label}` : 'Resize Image window'}
        aria-orientation={edge === 'e' || edge === 'w' ? 'vertical' : 'horizontal'}
        aria-valuetext={`${currentSize.width} by ${currentSize.height} pixels`} aria-valuenow={edge === 'e' || edge === 'w' ? currentSize.width : currentSize.height} tabIndex={0}
        {...pointer('resize', edge)} onKeyDown={event => key(event, 'resize', edge)} />)}
  </section>;
}
