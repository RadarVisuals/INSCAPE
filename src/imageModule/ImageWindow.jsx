import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useWorkbenchView, workbenchModuleTransform, useWorkbenchViewRegistration } from '../public/ownerSystemWorkflow/WorkbenchView.jsx';
import { useWorkbenchPlacement, useWorkbenchMovementSnap } from '../public/ownerSystemWorkflow/WorkbenchPlacement.jsx';
import { imageWindowGeometry, imageWindowPosition, imagePaintGeometry, resizeImageGeometry } from './imageWindowGeometry.js';
import { WORKBENCH_RESIZE_EDGES, workbenchResizeControl } from '../public/ownerSystemWorkflow/ownerSystemWorkflowWindowGeometry.js';
import { useWorkbenchCamera } from '../public/ownerSystemWorkflow/WorkbenchCamera.jsx';
import { clampWorkbenchPosition } from '../public/ownerSystemWorkflow/workbenchSpace.js';

// Image owns a borderless surface. Workbench owns the camera, placement bounds
// and snapping. No instrument-window sizing, chrome or content gutter is used.
export default function ImageWindow({ id, title, position, size, fitScale, fitSize, editable, active, suspended, placementModule,
  onPosition, onResize, onClose, resizeTarget, children }) {
  const node = useRef(null), gesture = useRef(null);
  const [preview, setPreview] = useState(null);
  const view = useWorkbenchView();
  const camera = workbenchModuleTransform(view, id);
  const { offset } = useWorkbenchCamera();
  const snapMovement = useWorkbenchMovementSnap();
  const currentSize = preview?.size || size, currentPosition = preview?.position || position;
  const currentFit = fitSize?.(currentSize) ?? fitScale;
  const width = currentSize.width * currentFit, height = currentSize.height * currentFit;
  const density = globalThis.devicePixelRatio || 1;
  const screen = imageWindowGeometry(currentPosition, { width, height }, camera, offset);
  const placement = useWorkbenchPlacement(node, placementModule, camera.scale, true, screen);
  useWorkbenchViewRegistration(id, node, true, { ...position, width: size.width * fitScale, height: size.height * fitScale }, resizeTarget);
  const latest = useRef(null);
  latest.current = { onPosition, placement };
  const finish = (cancelled = false) => {
    const active = gesture.current;
    if (!active) return;
    gesture.current = null;
    latest.current.placement.finish();
    if (active.kind === 'resize') {
      if (!cancelled && active.next) active.onResize(active.next.size, active.next.position);
      setPreview(null);
    } else if (cancelled) latest.current.onPosition(active.position);
    if (active.target.hasPointerCapture(active.id)) active.target.releasePointerCapture(active.id);
  };
  useEffect(() => {
    const cancel = event => { if (event.type === 'blur' || event.key === 'Escape') finish(true); };
    addEventListener('blur', cancel); addEventListener('keydown', cancel);
    return () => { removeEventListener('blur', cancel); removeEventListener('keydown', cancel); finish(true); };
  }, []);
  useEffect(() => { finish(true); }, [size.width, size.height, camera.scale, camera.x, camera.y, offset.x, offset.y, fitScale, suspended, editable, resizeTarget?.expected]);
  const begin = (event, kind, edge) => {
    if (suspended || event.button !== 0 || event.target.closest('button')) return;
    event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
    placement.begin(event);
    gesture.current = { id: event.pointerId, kind, x: event.clientX, y: event.clientY,
      position, size, edge, onResize, target: event.currentTarget };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveTo = (candidate, bypass) => {
    const bounded = clampWorkbenchPosition(candidate, { width, height });
    const projected = imageWindowGeometry(bounded, { width, height }, camera, offset);
    const snapped = placementModule ? snapMovement(projected, [node.current], camera.scale, bypass) : projected;
    onPosition(clampWorkbenchPosition(imageWindowPosition(snapped, camera, offset), { width, height }));
  };
  const resizeTo = (start, edge, delta, bypass) => resizeImageGeometry(start.position, start.size, fitScale, edge, delta,
    (axis, side, value) => placement.edge(axis, side, value, currentPosition, bypass), fitSize);
  const move = event => {
    const active = gesture.current;
    if (active?.id !== event.pointerId) return;
    const dx = (event.clientX - active.x) / camera.scale, dy = (event.clientY - active.y) / camera.scale;
    if (active.kind === 'move') moveTo({ left: active.position.left + dx, top: active.position.top + dy }, event.altKey);
    else {
      active.next = resizeTo(active, active.edge, { x: dx, y: dy }, event.altKey);
      setPreview(active.next);
    }
  };
  const pointer = (kind, edge) => ({ onPointerDown: event => begin(event, kind, edge), onPointerMove: move,
    onPointerUp: () => finish(), onPointerCancel: () => finish(true), onLostPointerCapture: () => finish(true) });
  const key = (event, kind, edge) => {
    if (suspended || event.target !== event.currentTarget || !event.key.startsWith('Arrow')) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 10 : 1;
    const dx = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
    const dy = event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0;
    placement.begin(event);
    if (kind === 'move') moveTo({ left: position.left + dx / camera.scale, top: position.top + dy / camera.scale }, event.altKey);
    else {
      const next = resizeTo({ position, size }, edge, { x: dx * fitScale, y: dy * fitScale }, event.altKey);
      onResize(next.size, next.position);
    }
    placement.finish();
  };
  // Round shared edges once, only for painting. The composited 2D surface maps
  // physical pixels to CSS pixels without a second fractional layout rounding.
  const paint = imagePaintGeometry(screen, density);
  return <section ref={node} className="image-module__window" aria-label={`Image — ${title}`} data-workbench-view-id={id}
    data-editable={editable || undefined} data-active={active || undefined} data-suspended={suspended || undefined}
    data-controls-below={screen.top < 56 || undefined}
    style={{ '--image-density': density, left: 0, top: 0, width: paint.width, height: paint.height,
      transformOrigin: '0 0', transform: `matrix(${1 / density},0,0,${1 / density},${paint.left / density},${paint.top / density})` }}>
    {children({ left: 0, top: 0, width: currentSize.width, height: currentSize.height })}
    {editable && <div className="image-module__bounds" aria-hidden="true" />}
    <header className="image-module__header" aria-label="Move Image window" data-workbench-selectable aria-keyshortcuts="Shift+Enter" tabIndex={0} {...pointer('move')} onKeyDown={event => key(event, 'move')}>
      <span>{title}</span><button type="button" aria-label={`Close ${title}`} onClick={onClose}><X size={14} /></button>
    </header>
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
