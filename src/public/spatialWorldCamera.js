const finiteOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
export const SPATIAL_POINTER_DRAG_THRESHOLD = 5;

export function normalizeSpatialPoint(point) {
  return { x: finiteOr(point?.x), y: finiteOr(point?.y) };
}

export function clampSpatialCamera(camera, bounds = {}) {
  const point = normalizeSpatialPoint(camera);
  const minimumX = finiteOr(bounds.minX, Number.NEGATIVE_INFINITY);
  const maximumX = finiteOr(bounds.maxX, Number.POSITIVE_INFINITY);
  const minimumY = finiteOr(bounds.minY, Number.NEGATIVE_INFINITY);
  const maximumY = finiteOr(bounds.maxY, Number.POSITIVE_INFINITY);
  return {
    x: clamp(point.x, Math.min(minimumX, maximumX), Math.max(minimumX, maximumX)),
    y: clamp(point.y, Math.min(minimumY, maximumY), Math.max(minimumY, maximumY))
  };
}

export function panSpatialCamera(originCamera, originPointer, currentPointer, bounds) {
  const camera = normalizeSpatialPoint(originCamera);
  const origin = normalizeSpatialPoint(originPointer);
  const current = normalizeSpatialPoint(currentPointer);
  return clampSpatialCamera({
    x: camera.x - (current.x - origin.x),
    y: camera.y - (current.y - origin.y)
  }, bounds);
}

export function exceedsSpatialPointerDragThreshold(originPointer, currentPointer, threshold = SPATIAL_POINTER_DRAG_THRESHOLD) {
  const origin = normalizeSpatialPoint(originPointer);
  const current = normalizeSpatialPoint(currentPointer);
  return Math.hypot(current.x - origin.x, current.y - origin.y) > Math.max(0, finiteOr(threshold, SPATIAL_POINTER_DRAG_THRESHOLD));
}

export function shouldActivateSpatialPointer(drag, cancelled = false) {
  return Boolean(drag && !cancelled && !drag.moved && !drag.panning && !drag.multiTouch);
}

export function finalizeSpatialPointer({ pointerId, pointerType, drag, sharedGesture, cancelled = false }) {
  const gesture = sharedGesture && typeof sharedGesture === 'object' ? sharedGesture : null;
  const sharedMultiTouch = Boolean(gesture?.multiTouch);

  if (pointerType !== 'mouse') gesture?.activePointers?.delete(pointerId);
  if (gesture?.activePointers?.size === 0) gesture.multiTouch = false;

  if (!drag || drag.pointerId !== pointerId) {
    return { drag, shouldActivate: false };
  }

  return {
    drag: null,
    shouldActivate: shouldActivateSpatialPointer(drag, cancelled || sharedMultiTouch)
  };
}

export function screenToSpatialWorld(screenPoint, camera) {
  const screen = normalizeSpatialPoint(screenPoint);
  const view = normalizeSpatialPoint(camera);
  return { x: screen.x + view.x, y: screen.y + view.y };
}

export function spatialWorldToScreen(worldPoint, camera) {
  const world = normalizeSpatialPoint(worldPoint);
  const view = normalizeSpatialPoint(camera);
  return { x: world.x - view.x, y: world.y - view.y };
}

export function getSpatialGridOffset(camera, spacing = 80) {
  const view = normalizeSpatialPoint(camera);
  const size = Math.max(1, Math.abs(finiteOr(spacing, 80)));
  const wrap = (value) => ((-value % size) + size) % size;
  return { x: wrap(view.x), y: wrap(view.y) };
}

export function getCenteredHorizontalGridOffset(cameraX, viewportWidth, spacing = 80) {
  const size = Math.max(1, Math.abs(finiteOr(spacing, 80)));
  const center = finiteOr(viewportWidth) / 2;
  return (((center - finiteOr(cameraX)) % size) + size) % size;
}
