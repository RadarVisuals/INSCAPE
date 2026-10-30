export { workbenchPaintGeometry as imagePaintGeometry } from '../public/ownerSystemWorkflow/workbenchPaintGeometry.js';
import { WORKBENCH_BOUNDS, clampWorkbenchPosition } from '../public/ownerSystemWorkflow/workbenchSpace.js';

// Exact projection: interaction never reads rounded paint geometry back into
// the saved Workbench position. Shared world edges stay shared at every zoom.
export function imageWindowGeometry(position, size, camera, offset) {
  return {
    left: position.left * camera.scale + camera.x + offset.x,
    top: position.top * camera.scale + camera.y + offset.y,
    width: size.width * camera.scale,
    height: size.height * camera.scale,
  };
}

export function imageWindowPosition(rectangle, camera, offset) {
  return { left: (rectangle.left - camera.x - offset.x) / camera.scale,
    top: (rectangle.top - camera.y - offset.y) / camera.scale };
}

// Resize authored dimensions around the opposite edge. Delta and snap values
// are exact Workbench coordinates; only the camera projects them onto the screen.
export function resizeImageGeometry(position, size, edge, delta, snap, bounds = WORKBENCH_BOUNDS) {
  const next = { position: { ...position }, size: { width: size.width, height: size.height } };
  // Each corner owns two independent edges. A horizontal drag must not change
  // height, and a vertical drag must not change width, even with snapping on.
  for (const [axis, key, start, end, before, after] of [
    ['x', 'width', 'left', 'right', 'w', 'e'], ['y', 'height', 'top', 'bottom', 'n', 's'],
  ]) {
    const reverse = edge.includes(before);
    if (!reverse && !edge.includes(after)) continue;
    if (!delta[axis]) continue;
    const anchor = position[start] + (reverse ? size[key] : 0);
    const moving = position[start] + (reverse ? 0 : size[key]) + delta[axis];
    const snapped = snap?.(axis, reverse ? start : end, moving) ?? moving;
    const requested = reverse ? anchor - snapped : snapped - anchor;
    const available = reverse ? anchor - bounds[start] : bounds[end] - anchor;
    next.size[key] = Math.max(32, Math.min(4096, Math.floor(available + 1e-7), Math.round(requested)));
    next.position[start] = reverse ? anchor - next.size[key] : anchor;
  }
  if (edge.includes('w')) next.position.left = position.left + size.width - next.size.width;
  if (edge.includes('n')) next.position.top = position.top + size.height - next.size.height;
  next.position = clampWorkbenchPosition(next.position, next.size, bounds);
  return next;
}
