const finiteOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

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
