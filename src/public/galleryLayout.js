import { clampSpatialCamera } from './spatialWorldCamera.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export const GALLERY_MINIMUM_SCREENS = 3;
export const GALLERY_CELL_SIZE = 64;
export const GALLERY_NARROW_CELL_SIZE = 48;
export const GALLERY_ORIGIN_X = 192;
export const GALLERY_POSITION_STEPS = 24;
// Lower this ratio to raise the horizon; increase it to give the wall more height.
export const GALLERY_HORIZON_RATIO = 0.78;

export function galleryCellSizeForViewport(width) {
  return (Number(width) || 1440) < 720 ? GALLERY_NARROW_CELL_SIZE : GALLERY_CELL_SIZE;
}

export function createGalleryLayout(objects, viewport) {
  const width = Math.max(320, Math.round(Number(viewport?.width) || 0));
  const height = Math.max(480, Math.round(Number(viewport?.height) || 0));
  const cellSize = galleryCellSizeForViewport(width);
  const originX = Math.max(64, Math.round(width * GALLERY_ORIGIN_X / 1440));
  const horizon = Math.round(height * GALLERY_HORIZON_RATIO);
  const wallTop = clamp(Math.round(height * 0.04), 28, 64);
  const wallHeight = Math.max(220, horizon - wallTop - 28);
  const ordered = [...(objects || [])].sort((first, second) =>
    (first.presentationOrder ?? 0) - (second.presentationOrder ?? 0) || first.id.localeCompare(second.id));

  const items = ordered.map((object) => {
    const columns = clamp(Math.round(Number(object.span?.columns) || 4), 2, 12);
    const rows = clamp(Math.round(Number(object.span?.rows) || 4), 2, 12);
    const rawWidth = columns * cellSize;
    const rawHeight = rows * cellSize;
    const scale = Math.min(1, wallHeight / rawHeight);
    const itemWidth = Math.round(rawWidth * scale);
    const itemHeight = Math.round(rawHeight * scale);
    const verticalRange = Math.max(0, wallHeight - itemHeight);
    const authoredColumn = Math.max(0, Math.round(Number(object.placement?.column) || 0));
    const authoredRow = Math.max(0, Math.round(Number(object.placement?.row) || 0));
    const rowProgress = clamp(authoredRow, 0, GALLERY_POSITION_STEPS) / GALLERY_POSITION_STEPS;
    const top = wallTop + Math.round(verticalRange * rowProgress);
    const left = originX + authoredColumn * cellSize;
    return { object, left, top, width: itemWidth, height: itemHeight };
  });

  const minimumWorldWidth = width * GALLERY_MINIMUM_SCREENS;
  const authoredRight = items.reduce((maximum, item) => Math.max(maximum, item.left + item.width), 0);
  const contentWidth = items.length ? authoredRight + Math.round(width * 0.45) : minimumWorldWidth;
  const worldWidth = Math.max(minimumWorldWidth, contentWidth);
  return { width, height, horizon, wallTop, wallHeight, cellSize, originX, worldWidth, maxCameraX: worldWidth - width, items };
}

export function galleryPlacementFromPoint({ worldX, viewportY, span }, layout) {
  const columns = clamp(Math.round(Number(span?.columns) || 4), 2, 12);
  const rows = clamp(Math.round(Number(span?.rows) || 4), 2, 12);
  const cellSize = layout.cellSize || GALLERY_CELL_SIZE;
  const originX = layout.originX ?? GALLERY_ORIGIN_X;
  const rawHeight = rows * cellSize;
  const itemHeight = Math.round(rawHeight * Math.min(1, layout.wallHeight / rawHeight));
  const verticalRange = Math.max(0, layout.wallHeight - itemHeight);
  const maxRow = GALLERY_POSITION_STEPS;
  const desiredTop = Number(viewportY) - itemHeight / 2;
  const rowProgress = verticalRange ? clamp((desiredTop - layout.wallTop) / verticalRange, 0, 1) : 0;
  return {
    column: clamp(Math.round((Number(worldX) - originX - columns * cellSize / 2) / cellSize), 0, 255 - columns + 1),
    row: Math.round(rowProgress * maxRow)
  };
}

export function moveGalleryGeometry(object, delta, layout) {
  const columns = clamp(Math.round(Number(object?.span?.columns) || 4), 2, 12);
  const rows = clamp(Math.round(Number(object?.span?.rows) || 4), 2, 12);
  const cellSize = layout.cellSize || GALLERY_CELL_SIZE;
  const rawHeight = rows * cellSize;
  const itemHeight = Math.round(rawHeight * Math.min(1, layout.wallHeight / rawHeight));
  const verticalRange = Math.max(0, layout.wallHeight - itemHeight);
  const maxRow = GALLERY_POSITION_STEPS;
  const rowStep = maxRow && verticalRange ? verticalRange / maxRow : cellSize;
  return {
    column: clamp(Math.round(Number(object?.placement?.column) || 0) + Math.round((Number(delta?.x) || 0) / cellSize), 0, 255 - columns + 1),
    row: clamp(Math.round(Number(object?.placement?.row) || 0) + Math.round((Number(delta?.y) || 0) / rowStep), 0, maxRow),
    columnSpan: columns,
    rowSpan: rows
  };
}

function artworkMetrics(columns, rows, placement, layout) {
  const cellSize = layout?.cellSize || GALLERY_CELL_SIZE;
  const rawWidth = columns * cellSize;
  const rawHeight = rows * cellSize;
  const scale = Math.min(1, layout.wallHeight / rawHeight);
  const width = Math.round(rawWidth * scale);
  const height = Math.round(rawHeight * scale);
  const verticalRange = Math.max(0, layout.wallHeight - height);
  const rowProgress = clamp(Math.round(Number(placement?.row) || 0), 0, GALLERY_POSITION_STEPS) / GALLERY_POSITION_STEPS;
  return {
    left: (layout.originX ?? GALLERY_ORIGIN_X) + Math.round(Number(placement?.column) || 0) * cellSize,
    top: layout.wallTop + Math.round(verticalRange * rowProgress),
    width,
    height,
    verticalRange
  };
}

function logicalRowFromTop(top, itemHeight, layout) {
  const verticalRange = Math.max(0, layout.wallHeight - itemHeight);
  if (!verticalRange) return 0;
  return Math.round(clamp((top - layout.wallTop) / verticalRange, 0, 1) * GALLERY_POSITION_STEPS);
}

export function resizeGalleryGeometry(object, delta, layout, corner = 'se') {
  const startColumns = clamp(Math.round(Number(object?.span?.columns) || 4), 2, 12);
  const startRows = clamp(Math.round(Number(object?.span?.rows) || 4), 2, 12);
  const cellSize = layout?.cellSize || GALLERY_CELL_SIZE;
  const horizontalDelta = (corner.includes('w') ? -1 : 1) * (Number(delta?.x) || 0);
  const verticalDelta = (corner.includes('n') ? -1 : 1) * (Number(delta?.y) || 0);
  const horizontalScale = (startColumns * cellSize + horizontalDelta) / (startColumns * cellSize);
  const verticalScale = (startRows * cellSize + verticalDelta) / (startRows * cellSize);
  const scale = Math.abs(horizontalScale - 1) >= Math.abs(verticalScale - 1) ? horizontalScale : verticalScale;
  const boundedScale = clamp(scale, Math.max(2 / startColumns, 2 / startRows), Math.min(12 / startColumns, 12 / startRows));
  const columnSpan = clamp(Math.round(startColumns * boundedScale), 2, 12);
  const rowSpan = clamp(Math.round(startRows * boundedScale), 2, 12);
  const before = artworkMetrics(startColumns, startRows, object?.placement, layout);
  const after = artworkMetrics(columnSpan, rowSpan, object?.placement, layout);
  const targetLeft = corner.includes('w') ? before.left + before.width - after.width : before.left;
  const targetTop = corner.includes('n') ? before.top + before.height - after.height : before.top;
  return {
    column: clamp(Math.round((targetLeft - (layout.originX ?? GALLERY_ORIGIN_X)) / cellSize), 0, 255 - columnSpan + 1),
    row: logicalRowFromTop(targetTop, after.height, layout),
    columnSpan,
    rowSpan
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
