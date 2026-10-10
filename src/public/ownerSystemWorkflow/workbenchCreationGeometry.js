import { clampWorkbenchPosition, unprojectWorkbenchPosition } from './workbenchSpace.js';

// Gesture endpoints share one camera snapshot; temporary view geometry never
// becomes authored position or size without removing that projection first.
export function workbenchCreationPlacement(start, end, camera, rectangle = false) {
  const first = unprojectWorkbenchPosition({ left: start.x, top: start.y }, camera.scale, camera.offset);
  const last = unprojectWorkbenchPosition({ left: end.x, top: end.y }, camera.scale, camera.offset);
  const dragged = Math.hypot(end.x - start.x, end.y - start.y) >= 5;
  if (!rectangle) return dragged ? null : { position: first };
  const size = dragged ? {
    width: Math.max(8, Math.min(3984, Math.abs(last.left - first.left))),
    height: Math.max(8, Math.min(3984, Math.abs(last.top - first.top))),
  } : { width: 288, height: 288 };
  const position = dragged ? { left: Math.min(first.left, last.left), top: Math.min(first.top, last.top) } : first;
  return { position: clampWorkbenchPosition(position, size), size };
}

export function sameCreationCamera(first, next) {
  return first.scale === next.scale && first.offset.x === next.offset.x && first.offset.y === next.offset.y;
}
