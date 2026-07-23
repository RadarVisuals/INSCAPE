import { clampSpatialCamera } from './spatialWorldCamera.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export const GALLERY_MINIMUM_SCREENS = 3;
export const GALLERY_CELL_SIZE = 52;
export const GALLERY_ORIGIN_X = 192;
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

  const items = ordered.map((object) => {
    const columns = clamp(Math.round(Number(object.span?.columns) || 4), 2, 12);
    const rows = clamp(Math.round(Number(object.span?.rows) || 4), 2, 12);
    const rawWidth = columns * 52;
    const rawHeight = rows * 52;
    const scale = Math.min(1, wallHeight / rawHeight);
    const itemWidth = Math.round(rawWidth * scale);
    const itemHeight = Math.round(rawHeight * scale);
    const verticalRange = Math.max(0, wallHeight - itemHeight);
    const authoredColumn = Math.max(0, Math.round(Number(object.placement?.column) || 0));
    const authoredRow = Math.max(0, Math.round(Number(object.placement?.row) || 0));
    const top = wallTop + clamp(authoredRow * GALLERY_CELL_SIZE, 0, verticalRange);
    const left = GALLERY_ORIGIN_X + authoredColumn * GALLERY_CELL_SIZE;
    return { object, left, top, width: itemWidth, height: itemHeight };
  });

  const minimumWorldWidth = width * GALLERY_MINIMUM_SCREENS;
  const authoredRight = items.reduce((maximum, item) => Math.max(maximum, item.left + item.width), 0);
  const contentWidth = items.length ? authoredRight + Math.round(width * 0.45) : minimumWorldWidth;
  const worldWidth = Math.max(minimumWorldWidth, contentWidth);
  return { width, height, horizon, wallTop, wallHeight, worldWidth, maxCameraX: worldWidth - width, items };
}

export function galleryPlacementFromPoint({ worldX, viewportY, span }, layout) {
  const columns = clamp(Math.round(Number(span?.columns) || 4), 2, 12);
  const rows = clamp(Math.round(Number(span?.rows) || 4), 2, 12);
  const maxRow = Math.max(0, Math.floor((layout.wallHeight - rows * GALLERY_CELL_SIZE) / GALLERY_CELL_SIZE));
  return {
    column: clamp(Math.round((Number(worldX) - GALLERY_ORIGIN_X - columns * GALLERY_CELL_SIZE / 2) / GALLERY_CELL_SIZE), 0, 255 - columns + 1),
    row: clamp(Math.round((Number(viewportY) - layout.wallTop - rows * GALLERY_CELL_SIZE / 2) / GALLERY_CELL_SIZE), 0, maxRow)
  };
}

export function moveGalleryGeometry(object, delta, layout) {
  const columns = clamp(Math.round(Number(object?.span?.columns) || 4), 2, 12);
  const rows = clamp(Math.round(Number(object?.span?.rows) || 4), 2, 12);
  const maxRow = Math.max(0, Math.floor((layout.wallHeight - rows * GALLERY_CELL_SIZE) / GALLERY_CELL_SIZE));
  return {
    column: clamp(Math.round(Number(object?.placement?.column) || 0) + Math.round((Number(delta?.x) || 0) / GALLERY_CELL_SIZE), 0, 255 - columns + 1),
    row: clamp(Math.round(Number(object?.placement?.row) || 0) + Math.round((Number(delta?.y) || 0) / GALLERY_CELL_SIZE), 0, maxRow),
    columnSpan: columns,
    rowSpan: rows
  };
}

export function resizeGalleryGeometry(object, delta) {
  const startColumns = clamp(Math.round(Number(object?.span?.columns) || 4), 2, 12);
  const startRows = clamp(Math.round(Number(object?.span?.rows) || 4), 2, 12);
  const horizontalScale = (startColumns * GALLERY_CELL_SIZE + (Number(delta?.x) || 0)) / (startColumns * GALLERY_CELL_SIZE);
  const verticalScale = (startRows * GALLERY_CELL_SIZE + (Number(delta?.y) || 0)) / (startRows * GALLERY_CELL_SIZE);
  const scale = Math.abs(horizontalScale - 1) >= Math.abs(verticalScale - 1) ? horizontalScale : verticalScale;
  const boundedScale = clamp(scale, Math.max(2 / startColumns, 2 / startRows), Math.min(12 / startColumns, 12 / startRows));
  return {
    column: Math.round(Number(object?.placement?.column) || 0),
    row: Math.round(Number(object?.placement?.row) || 0),
    columnSpan: clamp(Math.round(startColumns * boundedScale), 2, 12),
    rowSpan: clamp(Math.round(startRows * boundedScale), 2, 12)
  };
}

export function gallerySpanForAspectRatio(aspectRatio) {
  const ratio = Number(aspectRatio);
  if (!Number.isFinite(ratio) || ratio <= 0) return { columns: 4, rows: 4 };
  const longSide = 6;
  return ratio >= 1
    ? { columns: longSide, rows: clamp(Math.round(longSide / ratio), 2, 12) }
    : { columns: clamp(Math.round(longSide * ratio), 2, 12), rows: longSide };
}

export function clampGalleryCamera(cameraX, maxCameraX) {
  return clampSpatialCamera(
    { x: Number(cameraX) || 0, y: 0 },
    { minX: 0, maxX: Math.max(0, Number(maxCameraX) || 0), minY: 0, maxY: 0 }
  ).x;
}
