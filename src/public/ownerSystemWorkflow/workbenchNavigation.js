// All rectangles are in Workbench coordinates or host-local screen coordinates,
// as specified by the caller. None of these calculations change module geometry.
export function workbenchDestinationCamera(bounds, viewport, minimumScale = .25) {
  if (!bounds || !viewport || ![bounds.left, bounds.top, bounds.width, bounds.height,
    viewport.left, viewport.top, viewport.width, viewport.height].every(Number.isFinite)
    || bounds.width <= 0 || bounds.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return null;
  const margin = Math.min(32, viewport.width / 4, viewport.height / 4);
  const scale = Math.max(minimumScale, Math.min(2,
    (viewport.width - margin * 2) / bounds.width, (viewport.height - margin * 2) / bounds.height));
  return { scale, offset: {
    x: viewport.left + viewport.width / 2 - (bounds.left + bounds.width / 2) * scale,
    y: viewport.top + viewport.height / 2 - (bounds.top + bounds.height / 2) * scale,
  } };
}

// Floating instruments keep their own positions. Find usable space around the
// visible instruments, retaining a bounded set of candidate rectangles.
export function workbenchNavigationViewport(viewport, obstacles) {
  let candidates = [{ left: 0, top: 0, ...viewport }];
  for (const obstacle of obstacles) {
    candidates = candidates.flatMap(rect => {
      const left = Math.max(rect.left, obstacle.left), top = Math.max(rect.top, obstacle.top);
      const right = Math.min(rect.left + rect.width, obstacle.left + obstacle.width);
      const bottom = Math.min(rect.top + rect.height, obstacle.top + obstacle.height);
      if (right <= left || bottom <= top) return [rect];
      return [
        { ...rect, width: left - rect.left },
        { ...rect, left: right, width: rect.left + rect.width - right },
        { ...rect, height: top - rect.top },
        { ...rect, top: bottom, height: rect.top + rect.height - bottom },
      ].filter(next => next.width >= Math.min(240, viewport.width / 2)
        && next.height >= Math.min(180, viewport.height / 2));
    }).sort((a, b) => b.width * b.height - a.width * a.height).slice(0, 32);
    if (!candidates.length) return { left: 0, top: 0, ...viewport };
  }
  return candidates[0];
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
// The navigation owner applies today's frame limits after this calculation.
export function restoreWorkbenchCamera(camera, previousViewport, viewport) {
  if (!previousViewport || !viewport) return camera;
  return { scale: camera.scale, offset: {
    x: camera.offset.x + (viewport.width - previousViewport.width) / 2,
    y: camera.offset.y + (viewport.height - previousViewport.height) / 2,
  } };
}
