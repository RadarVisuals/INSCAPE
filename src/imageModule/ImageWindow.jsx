import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useWorkbenchView, workbenchModuleTransform, useWorkbenchViewRegistration } from '../public/ownerSystemWorkflow/WorkbenchView.jsx';
import { useWorkbenchPlacement, useWorkbenchMovementSnap } from '../public/ownerSystemWorkflow/WorkbenchPlacement.jsx';
import { imageWindowGeometry, imageWindowPosition, imagePaintGeometry } from './imageWindowGeometry.js';
import { useWorkbenchCamera } from '../public/ownerSystemWorkflow/WorkbenchCamera.jsx';
import { clampWorkbenchPosition, WORKBENCH_BOUNDS } from '../public/ownerSystemWorkflow/workbenchSpace.js';

// Image owns a borderless surface. Workbench owns the camera, placement bounds
// and snapping. No instrument-window sizing, chrome or content gutter is used.
export default function ImageWindow({ id, title, position, size, fitScale, editable, suspended, placementModule,
  onPosition, onResize, onClose, resizeTarget, children }) {
  const node = useRef(null), gesture = useRef(null);
  const [preview, setPreview] = useState(null);
  const view = useWorkbenchView();
  const camera = workbenchModuleTransform(view, id);
  const { offset } = useWorkbenchCamera();
  const snapMovement = useWorkbenchMovementSnap();
  const currentSize = preview || size;
  const width = currentSize.width * fitScale, height = currentSize.height * fitScale;
  const density = globalThis.devicePixelRatio || 1;
  const screen = imageWindowGeometry(position, { width, height }, camera, offset);
  const placement = useWorkbenchPlacement(node, placementModule, camera.scale, true, screen);
  useWorkbenchViewRegistration(id, node, true, { ...position, width, height }, resizeTarget);
  const latest = useRef(null);
  latest.current = { onPosition, onResize, placement };
  const finish = (cancelled = false) => {
    const active = gesture.current;
    if (!active) return;
    gesture.current = null;
    latest.current.placement.finish();
    if (active.kind === 'resize') {
      if (!cancelled && active.next) latest.current.onResize(active.next);
      setPreview(null);
    } else if (cancelled) latest.current.onPosition(active.position);
    if (active.target.hasPointerCapture(active.id)) active.target.releasePointerCapture(active.id);
  };
  useEffect(() => {
    const cancel = event => { if (event.type === 'blur' || event.key === 'Escape') finish(true); };
    addEventListener('blur', cancel); addEventListener('keydown', cancel);
    return () => { removeEventListener('blur', cancel); removeEventListener('keydown', cancel); finish(true); };
  }, []);
  useEffect(() => { finish(true); }, [size.width, size.height, camera.scale, fitScale, suspended, editable]);
  const begin = (event, kind) => {
    if (suspended || event.button !== 0 || event.target.closest('button')) return;
    event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
    placement.begin(event);
    gesture.current = { id: event.pointerId, kind, x: event.clientX, y: event.clientY,
      position, size, target: event.currentTarget };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveTo = (candidate, bypass) => {
    const bounded = clampWorkbenchPosition(candidate, { width, height });
    const projected = imageWindowGeometry(bounded, { width, height }, camera, offset);
    const snapped = placementModule ? snapMovement(projected, [node.current], camera.scale, bypass) : projected;
    onPosition(clampWorkbenchPosition(imageWindowPosition(snapped, camera, offset), { width, height }));
  };
  const resizeTo = (candidate, bypass) => {
    const bounded = {};
    const origin = imageWindowPosition(screen, camera, offset);
    const projected = imageWindowGeometry(position, { width: candidate.width * fitScale, height: candidate.height * fitScale }, camera, offset);
    for (const [axis, key, edge, start] of [['x', 'width', 'right', origin.left], ['y', 'height', 'bottom', origin.top]]) {
      const target = start + projected[key] / camera.scale;
      const snapped = placement.edge(axis, edge, target, origin, bypass);
      const requested = snapped === null ? candidate[key] : (snapped - start) / fitScale;
      bounded[key] = Math.round(Math.max(32, Math.min(4096, (WORKBENCH_BOUNDS[edge] - start) / fitScale, requested)));
    }
    return bounded;
  };
  const move = event => {
    const active = gesture.current;
    if (active?.id !== event.pointerId) return;
    const dx = (event.clientX - active.x) / camera.scale, dy = (event.clientY - active.y) / camera.scale;
    if (active.kind === 'move') moveTo({ left: active.position.left + dx, top: active.position.top + dy }, event.altKey);
    else {
      active.next = resizeTo({ width: active.size.width + dx / fitScale, height: active.size.height + dy / fitScale }, event.altKey);
      setPreview(active.next);
    }
  };
  const pointer = kind => ({ onPointerDown: event => begin(event, kind), onPointerMove: move,
    onPointerUp: () => finish(), onPointerCancel: () => finish(true), onLostPointerCapture: () => finish(true) });
  const key = (event, kind) => {
    if (suspended || event.target !== event.currentTarget || !event.key.startsWith('Arrow')) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 10 : 1;
    const dx = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
    const dy = event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0;
    placement.begin(event);
    if (kind === 'move') moveTo({ left: position.left + dx / camera.scale, top: position.top + dy / camera.scale }, event.altKey);
    else onResize(resizeTo({ width: size.width + dx, height: size.height + dy }, event.altKey));
    placement.finish();
  };
  // Round shared edges once, only for painting. The composited 2D surface maps
  // physical pixels to CSS pixels without a second fractional layout rounding.
  const paint = imagePaintGeometry(screen, density);
  return <section ref={node} className="image-module__window" aria-label={`Image — ${title}`} data-workbench-view-id={id}
    style={{ '--image-density': density, left: 0, top: 0, width: paint.width, height: paint.height,
      transformOrigin: '0 0', transform: `matrix(${1 / density},0,0,${1 / density},${paint.left / density},${paint.top / density})` }}>
    {children({ left: 0, top: 0, width: currentSize.width, height: currentSize.height })}
    <header className="image-module__header" aria-label="Move Image window" data-workbench-selectable aria-keyshortcuts="Shift+Enter" tabIndex={0} {...pointer('move')} onKeyDown={event => key(event, 'move')}>
      <span>{title}</span><button type="button" aria-label={`Close ${title}`} onClick={onClose}><X size={14} /></button>
    </header>
    {editable && <div className="image-module__resize" role="separator" aria-label="Resize Image window" aria-orientation="horizontal"
      aria-valuetext={`${currentSize.width} by ${currentSize.height} pixels`} aria-valuenow={currentSize.height} tabIndex={0}
      {...pointer('resize')} onKeyDown={event => key(event, 'resize')} />}
  </section>;
}
