import { clampSpatialCamera } from './spatialWorldCamera.js';

export const HOME_WORLD_CAMERA_VERSION = 2;
export const HOME_WORLD_CAMERA_LIMIT = 200000;
export const HOME_WORLD_ZOOM_LEVELS = Object.freeze([0.5, 0.75, 1, 1.25]);
export const HOME_WORLD_REVEAL_VISIBLE_RATIO = 0.6;

export function homeWorldCameraKey(profileAddress) {
  const profile = typeof profileAddress === 'string' && profileAddress.trim()
    ? profileAddress.trim().toLowerCase()
    : 'local';
  return `os-underneath.home-world-camera.v2:${profile}`;
}

export function normalizeHomeWorldCamera(camera) {
  const point = clampSpatialCamera(camera, {
    minX: -HOME_WORLD_CAMERA_LIMIT,
    maxX: HOME_WORLD_CAMERA_LIMIT,
    minY: -HOME_WORLD_CAMERA_LIMIT,
    maxY: HOME_WORLD_CAMERA_LIMIT
  });
  const requestedZoom = Number(camera?.zoom) || 1;
  const zoom = HOME_WORLD_ZOOM_LEVELS.reduce((nearest, candidate) => (
    Math.abs(candidate - requestedZoom) < Math.abs(nearest - requestedZoom) ? candidate : nearest
  ), 1);
  return { ...point, zoom };
}

export function clampHomeWorldCamera(camera, world) {
  const normalized = normalizeHomeWorldCamera(camera);
  const viewportWidth = Math.max(0, Number(world?.viewportWidth) || 0) / normalized.zoom;
  const viewportHeight = Math.max(0, Number(world?.viewportHeight) || 0) / normalized.zoom;
  const maxX = Math.max(0, (Number(world?.width) || 0) - viewportWidth);
  const maxY = Math.max(0, (Number(world?.height) || 0) - viewportHeight);
  return { ...normalized, ...clampSpatialCamera(normalized, { minX: 0, maxX, minY: 0, maxY }) };
}

export function getZoomedHomeWorldCamera(camera, nextZoom, anchor, world) {
  const current = normalizeHomeWorldCamera(camera);
  const zoomed = normalizeHomeWorldCamera({ ...current, zoom: nextZoom });
  const anchorX = Number.isFinite(anchor?.x) ? anchor.x : world.viewportWidth / 2;
  const anchorY = Number.isFinite(anchor?.y) ? anchor.y : world.viewportHeight / 2;
  const worldX = current.x + anchorX / current.zoom;
  const worldY = current.y + anchorY / current.zoom;
  const maxX = Math.max(0, world.width - world.viewportWidth / zoomed.zoom);
  const maxY = Math.max(0, world.height - world.viewportHeight / zoomed.zoom);
  return {
    x: Math.max(0, Math.min(maxX, worldX - anchorX / zoomed.zoom)),
    y: Math.max(0, Math.min(maxY, worldY - anchorY / zoomed.zoom)),
    zoom: zoomed.zoom
  };
}

export function getWindowRevealCamera(camera, rect, geometry, world, options = {}) {
  if (!rect || !geometry || !world) return null;
  const normalized = normalizeHomeWorldCamera(camera);
  const zoom = normalized.zoom;
  const viewportWidth = world.viewportWidth / zoom;
  const viewportHeight = world.viewportHeight / zoom;
  const left = Number(options.worldOffsetX || 0) + rect.column * geometry.cellWidth;
  const top = Number(options.worldOffsetY || 0) + rect.row * geometry.cellHeight;
  const width = rect.columnSpan * geometry.cellWidth;
  const height = rect.rowSpan * geometry.cellHeight;
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;

  const visibleWidth = Math.max(0, Math.min(left + width, normalized.x + viewportWidth) - Math.max(left, normalized.x));
  const visibleHeight = Math.max(0, Math.min(top + height, normalized.y + viewportHeight) - Math.max(top, normalized.y));
  const visibleRatio = (visibleWidth * visibleHeight) / (width * height);
  const minimumVisibleRatio = Number(options.minimumVisibleRatio) || HOME_WORLD_REVEAL_VISIBLE_RATIO;
  if (visibleRatio >= minimumVisibleRatio) return null;

  const padding = Math.max(0, Number(options.padding) || 56) / zoom;
  const safeWidth = Math.max(1, viewportWidth - padding * 2);
  const safeHeight = Math.max(1, viewportHeight - padding * 2);
  const revealAxis = (start, size, viewStart, viewSize, safeSize) => {
    if (size > safeSize) return start + size / 2 - viewSize / 2;
    if (start < viewStart + padding) return start - padding;
    if (start + size > viewStart + viewSize - padding) return start + size + padding - viewSize;
    return viewStart;
  };
  const maxX = Math.max(0, world.width - viewportWidth);
  const maxY = Math.max(0, world.height - viewportHeight);
  return {
    x: Math.max(0, Math.min(maxX, revealAxis(left, width, normalized.x, viewportWidth, safeWidth))),
    y: Math.max(0, Math.min(maxY, revealAxis(top, height, normalized.y, viewportHeight, safeHeight))),
    zoom
  };
}

export function loadHomeWorldCamera(storage, profileAddress, fallback = { x: 0, y: 0, zoom: 1 }) {
  try {
    const record = JSON.parse(storage?.getItem?.(homeWorldCameraKey(profileAddress)) || 'null');
    return record?.version === HOME_WORLD_CAMERA_VERSION
      ? normalizeHomeWorldCamera(record.camera)
      : normalizeHomeWorldCamera(fallback);
  } catch {
    return normalizeHomeWorldCamera(fallback);
  }
}

export function saveHomeWorldCamera(storage, profileAddress, camera) {
  try {
    storage?.setItem?.(homeWorldCameraKey(profileAddress), JSON.stringify({
      version: HOME_WORLD_CAMERA_VERSION,
      camera: normalizeHomeWorldCamera(camera)
    }));
    return true;
  } catch {
    return false;
  }
}
