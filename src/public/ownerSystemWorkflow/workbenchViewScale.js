import { workbenchPaintStyle } from './workbenchPaintGeometry.js';
export const WORKBENCH_VIEW_SCALES = [.25, .33, .5, .67, .75, .8, .9, 1];

export function zoomWorkbenchCamera(scale, offset, nextScale, anchor) {
  const next = Math.max(.25, Math.min(2, nextScale));
  const ratio = next / scale;
  return { scale: next, offset: { x: anchor.x - (anchor.x - offset.x) * ratio,
    y: anchor.y - (anchor.y - offset.y) * ratio } };
}

export function stepWorkbenchViewScale(scale, direction) {
  return direction > 0
    ? WORKBENCH_VIEW_SCALES.find(value => value > scale + .001) ?? 1
    : WORKBENCH_VIEW_SCALES.findLast(value => value < scale - .001) ?? .25;
}

// Scale the window and its distance from the Workbench origin. Saved geometry
// and logical content width stay unchanged; only the painted frame is rounded.
export function workbenchViewStyle(scale, left, top, width, height, x = 0, y = 0, offset = { x: 0, y: 0 }) {
  return { ...workbenchPaintStyle({ left, top, width, height }, { scale, x, y }, offset),
    '--workbench-content-width': `${width}px` };
}

export const identityWorkbenchTransform = Object.freeze({ scale: 1, x: 0, y: 0 });
export function clampWorkbenchMove(rect, delta, viewport) {
  const axis = (start, size, change, min, max) => Math.max(min - start, Math.min(Math.max(min, max - size) - start, change));
  return { x: axis(rect.left, rect.width, delta.x, viewport.left, viewport.right),
    y: axis(rect.top, rect.height, delta.y, viewport.top, viewport.bottom) };
}
export function scaleWorkbenchTransform(transform, factor, anchor) {
  return { scale: transform.scale * factor,
    x: anchor.x + (transform.x - anchor.x) * factor,
    y: anchor.y + (transform.y - anchor.y) * factor };
}
export function scaleWorkbenchRectangle(rectangle, factor, anchor) {
  return { left: anchor.x + (rectangle.left - anchor.x) * factor,
    top: anchor.y + (rectangle.top - anchor.y) * factor,
    width: rectangle.width * factor, height: rectangle.height * factor };
}
export function workbenchSelectionBounds(rectangles) {
  if (!rectangles.length) return null;
  const left = Math.min(...rectangles.map(rect => rect.left)), top = Math.min(...rectangles.map(rect => rect.top));
  return { left, top, width: Math.max(...rectangles.map(rect => rect.left + rect.width)) - left,
    height: Math.max(...rectangles.map(rect => rect.top + rect.height)) - top };
}
