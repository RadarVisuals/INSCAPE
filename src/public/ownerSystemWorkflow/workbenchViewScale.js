export const WORKBENCH_VIEW_SCALES = [.25, .33, .5, .67, .75, .8, .9, 1];

export function stepWorkbenchViewScale(scale, direction) {
  return direction > 0
    ? WORKBENCH_VIEW_SCALES.find(value => value > scale + .001) ?? 1
    : WORKBENCH_VIEW_SCALES.findLast(value => value < scale - .001) ?? .25;
}

// Scale the window and its distance from the Workbench origin. Saved geometry
// and logical content width stay unchanged; only the painted frame is rounded.
export function workbenchViewStyle(scale, left, top, width, height, x = 0, y = 0) {
  if (scale === 1 && !x && !y) return undefined;
  const snap = value => Math.round(value);
  // Native zoom paints at the target size. Separate transformed window textures
  // can filter adjoining edges and soften text. Snap both ends of the visible
  // frame to CSS pixels together; content keeps its logical wrapping width.
  // Device-pixel snapping leaves fractional CSS clipping boundaries at Windows
  // display scales such as 125%, exposing seams between nested painted surfaces.
  const screenLeft = snap(left * scale + x), screenTop = snap(top * scale + y);
  return {
    zoom: scale,
    left: screenLeft / scale,
    top: screenTop / scale,
    width: (snap((left + width) * scale + x) - screenLeft) / scale,
    height: (snap((top + height) * scale + y) - screenTop) / scale,
    '--workbench-content-width': `${width}px`,
  };
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
export function workbenchSelectionBounds(rectangles) {
  if (!rectangles.length) return null;
  const left = Math.min(...rectangles.map(rect => rect.left)), top = Math.min(...rectangles.map(rect => rect.top));
  return { left, top, width: Math.max(...rectangles.map(rect => rect.left + rect.width)) - left,
    height: Math.max(...rectangles.map(rect => rect.top + rect.height)) - top };
}
