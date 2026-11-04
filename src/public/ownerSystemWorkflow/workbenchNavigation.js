// All rectangles are in Workbench coordinates or host-local screen coordinates,
// as specified by the caller. None of these calculations change module geometry.
export function workbenchDestinationCamera(bounds, viewport, minimumScale = .25, padding = 32, maximumScale = 2) {
  if (!bounds || !viewport || ![bounds.left, bounds.top, bounds.width, bounds.height,
    viewport.left, viewport.top, viewport.width, viewport.height].every(Number.isFinite)
    || bounds.width <= 0 || bounds.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return null;
  const margin = Math.min(Math.max(0, padding), viewport.width / 4, viewport.height / 4);
  const scale = Math.max(minimumScale, Math.min(maximumScale,
    (viewport.width - margin * 2) / bounds.width, (viewport.height - margin * 2) / bounds.height));
  return { scale, offset: {
    x: viewport.left + viewport.width / 2 - (bounds.left + bounds.width / 2) * scale,
    y: viewport.top + viewport.height / 2 - (bounds.top + bounds.height / 2) * scale,
  } };
}

// Explicit navigation fits between fixed docks and above measured controls.
// Floating windows do not reserve camera space.
export function workbenchNavigationViewport(viewport, controlsTop) {
  const top = viewport.top || 0;
  const bottom = Number.isFinite(controlsTop) ? Math.min(viewport.height, controlsTop - 8) : viewport.height;
  return { left: viewport.left || 0, top, width: viewport.width, height: Math.max(0, bottom - top) };
}

export function interpolateWorkbenchCamera(start, end, progress) {
  if (progress >= 1) return end;
  if (progress <= 0) return start;
  const mix = (a, b) => a + (b - a) * progress;
  return { scale: mix(start.scale, end.scale), offset: {
    x: mix(start.offset.x, end.offset.x), y: mix(start.offset.y, end.offset.y),
  } };
}

// Back retains the old world centre when the available viewport has changed.
// The work area never clamps a restored camera, including older outlying views.
export function restoreWorkbenchCamera(camera, previousViewport, viewport) {
  if (!previousViewport || !viewport) return camera;
  return { scale: camera.scale, offset: {
    x: camera.offset.x + (viewport.left || 0) - (previousViewport.left || 0) + (viewport.width - previousViewport.width) / 2,
    y: camera.offset.y + (viewport.height - previousViewport.height) / 2,
  } };
}
