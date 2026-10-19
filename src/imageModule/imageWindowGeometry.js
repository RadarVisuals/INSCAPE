export { workbenchPaintGeometry as imagePaintGeometry } from '../public/ownerSystemWorkflow/workbenchPaintGeometry.js';
import { WORKBENCH_BOUNDS, clampWorkbenchPosition } from '../public/ownerSystemWorkflow/workbenchSpace.js';
import { proportionalCornerResize } from '../public/ownerSystemWorkflow/workbenchViewScale.js';

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
// are exact Workbench coordinates; fitting affects presentation, not saved size.
export function resizeImageGeometry(position, size, fitScale, edge, delta, snap, fitSize, bounds = WORKBENCH_BOUNDS) {
  const next = { position: { ...position }, size: { width: size.width, height: size.height } };
  if (edge.length === 2) {
    const vector = { x: (edge.includes('w') ? -1 : 1) * size.width * fitScale,
      y: (edge.includes('n') ? -1 : 1) * size.height * fitScale };
    const anchor = { x: position.left + (edge.includes('w') ? size.width * fitScale : 0),
      y: position.top + (edge.includes('n') ? size.height * fitScale : 0) };
    const { axis, factor } = proportionalCornerResize(vector, delta);
    const side = axis === 'x' ? (edge.includes('w') ? 'left' : 'right') : (edge.includes('n') ? 'top' : 'bottom');
    const moving = anchor[axis] + vector[axis] * factor;
    // Snap only the driving edge. The other dimension follows the same factor;
    // independently snapping both axes would change the artwork's proportions.
    const snapped = snap?.(axis, side, moving);
    const requested = snapped == null || snapped === moving ? factor : (snapped - anchor[axis]) / vector[axis];
    const availableWidth = (edge.includes('w') ? anchor.x - bounds.left : bounds.right - anchor.x) / fitScale;
    const availableHeight = (edge.includes('n') ? anchor.y - bounds.top : bounds.bottom - anchor.y) / fitScale;
    const minimum = Math.max(32 / size.width, 32 / size.height);
    const maximum = Math.min(4096 / size.width, 4096 / size.height,
      Math.floor(availableWidth + 1e-7) / size.width, Math.floor(availableHeight + 1e-7) / size.height);
    const bounded = Math.max(minimum, Math.min(maximum, requested));
    const round = value => Math.round(Math.round(value * 1e7) / 1e7);
    next.size = { width: round(size.width * bounded), height: round(size.height * bounded) };
  } else for (const [axis, key, start, end, before, after] of [
    ['x', 'width', 'left', 'right', 'w', 'e'], ['y', 'height', 'top', 'bottom', 'n', 's'],
  ]) {
    const reverse = edge.includes(before);
    if (!reverse && !edge.includes(after)) continue;
    const anchor = position[start] + (reverse ? size[key] * fitScale : 0);
    const moving = position[start] + (reverse ? 0 : size[key] * fitScale) + delta[axis];
    const snapped = snap?.(axis, reverse ? start : end, moving) ?? moving;
    const requested = (reverse ? anchor - snapped : snapped - anchor) / fitScale;
    const available = (reverse ? anchor - bounds[start] : bounds[end] - anchor) / fitScale;
    next.size[key] = Math.max(32, Math.min(4096, Math.floor(available + 1e-7), Math.round(requested)));
    next.position[start] = reverse ? anchor - next.size[key] * fitScale : anchor;
  }
  // A large canvas may fit differently after an edit. Preview the same fit the
  // saved module will use, retaining the opposite edge without a release jump.
  const nextFit = fitSize?.(next.size) ?? fitScale;
  if (edge.includes('w')) next.position.left = position.left + size.width * fitScale - next.size.width * nextFit;
  if (edge.includes('n')) next.position.top = position.top + size.height * fitScale - next.size.height * nextFit;
  next.position = clampWorkbenchPosition(next.position, { width: next.size.width * nextFit, height: next.size.height * nextFit }, bounds);
  return next;
}
