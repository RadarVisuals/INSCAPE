import { clampSpatialCamera } from './spatialWorldCamera.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export const GALLERY_MINIMUM_SCREENS = 3;
// Lower this ratio to raise the horizon; increase it to give the wall more height.
export const GALLERY_HORIZON_RATIO = 0.78;

export function createGalleryLayout(objects, viewport) {
  const width = Math.max(320, Math.round(Number(viewport?.width) || 0));
  const height = Math.max(480, Math.round(Number(viewport?.height) || 0));
  const horizon = Math.round(height * GALLERY_HORIZON_RATIO);
  const wallTop = 106;
  const wallHeight = Math.max(220, horizon - wallTop - 28);
  const ordered = [...(objects || [])].sort((first, second) =>
    (first.presentationOrder ?? 0) - (second.presentationOrder ?? 0) || first.id.localeCompare(second.id));

  let cursor = Math.max(240, Math.round(width * 0.44));
  const items = ordered.map((object, index) => {
    const columns = clamp(Math.round(Number(object.span?.columns) || 4), 2, 12);
    const rows = clamp(Math.round(Number(object.span?.rows) || 4), 2, 12);
    const rawWidth = columns * 52;
    const rawHeight = rows * 52;
    const fitScale = Math.min(1, 380 / rawWidth, wallHeight / rawHeight);
    const minimumScale = Math.min(1.35, 148 / Math.min(rawWidth, rawHeight));
    const scale = Math.min(Math.max(fitScale, minimumScale), 380 / rawWidth, wallHeight / rawHeight);
    const itemWidth = Math.max(112, Math.round(rawWidth * scale));
    const itemHeight = Math.max(112, Math.round(rawHeight * scale));
    const verticalRange = Math.max(0, wallHeight - itemHeight);
    const authoredRow = Math.max(0, Math.round(Number(object.placement?.row) || 0));
    const top = wallTop + Math.round(verticalRange * (((authoredRow + index) % 5) / 6));
    const left = cursor;
    cursor += itemWidth + clamp(Math.round(width * 0.13), 150, 260);
    return { object, left, top, width: itemWidth, height: itemHeight };
  });

  const minimumWorldWidth = width * GALLERY_MINIMUM_SCREENS;
  const contentWidth = items.length ? cursor + Math.round(width * 0.45) : minimumWorldWidth;
  const worldWidth = Math.max(minimumWorldWidth, contentWidth);
  return { width, height, horizon, worldWidth, maxCameraX: worldWidth - width, items };
}

export function clampGalleryCamera(cameraX, maxCameraX) {
  return clampSpatialCamera(
    { x: Number(cameraX) || 0, y: 0 },
    { minX: 0, maxX: Math.max(0, Number(maxCameraX) || 0), minY: 0, maxY: 0 }
  ).x;
}
