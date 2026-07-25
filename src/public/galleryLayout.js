import { clampSpatialCamera } from './spatialWorldCamera.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export const GALLERY_MINIMUM_SCREENS = 3;
export const GALLERY_CELL_SIZE = 64;
export const GALLERY_GRID_SIZE = 80;
export const GALLERY_ORIGIN_X = 192;
export const GALLERY_POSITION_STEPS = 24;
export const GALLERY_REFERENCE_HEIGHT = 900;
// Lower this ratio to raise the horizon; increase it to give the wall more height.
export const GALLERY_HORIZON_RATIO = 0.78;

const referenceHorizon = Math.round(GALLERY_REFERENCE_HEIGHT * GALLERY_HORIZON_RATIO);
const referenceWallTop = clamp(Math.round(GALLERY_REFERENCE_HEIGHT * 0.04), 28, 64);
export const GALLERY_REFERENCE_WALL_HEIGHT = referenceHorizon - referenceWallTop - 28;

function artworkDimensions(columns, rows, layout) {
  const sceneScale = layout?.sceneScale || 1;
  const rawWidth = columns * GALLERY_CELL_SIZE;
  const rawHeight = rows * GALLERY_CELL_SIZE;
  const fitScale = Math.min(1, GALLERY_REFERENCE_WALL_HEIGHT / rawHeight);
  return {
    width: Math.round(rawWidth * fitScale * sceneScale),
    height: Math.round(rawHeight * fitScale * sceneScale)
  };
}

export function galleryCellSizeForViewport(viewport) {
  const height = typeof viewport === 'object' ? viewport?.height : GALLERY_REFERENCE_HEIGHT;
  const safeHeight = Math.max(480, Math.round(Number(height) || GALLERY_REFERENCE_HEIGHT));
  const horizon = Math.round(safeHeight * GALLERY_HORIZON_RATIO);
  const wallTop = clamp(Math.round(safeHeight * 0.04), 28, 64);
  const wallHeight = Math.max(220, horizon - wallTop - 28);
  return GALLERY_CELL_SIZE * (wallHeight / GALLERY_REFERENCE_WALL_HEIGHT);
}

export function createGalleryLayout(objects, viewport) {
  const width = Math.max(320, Math.round(Number(viewport?.width) || 0));
  const height = Math.max(480, Math.round(Number(viewport?.height) || 0));
  const horizon = Math.round(height * GALLERY_HORIZON_RATIO);
  const wallTop = clamp(Math.round(height * 0.04), 28, 64);
  const wallHeight = Math.max(220, horizon - wallTop - 28);
  const sceneScale = wallHeight / GALLERY_REFERENCE_WALL_HEIGHT;
  const cellSize = GALLERY_CELL_SIZE * sceneScale;
  const gridSpacing = GALLERY_GRID_SIZE * sceneScale;
  const originX = GALLERY_ORIGIN_X * sceneScale;
  const ordered = [...(objects || [])].sort((first, second) =>
    (first.presentationOrder ?? 0) - (second.presentationOrder ?? 0) || first.id.localeCompare(second.id));

  const items = ordered.map((object) => {
    const columns = clamp(Math.round(Number(object.span?.columns) || 4), 2, 12);
    const rows = clamp(Math.round(Number(object.span?.rows) || 4), 2, 12);
    const { width: itemWidth, height: itemHeight } = artworkDimensions(columns, rows, { sceneScale });
    const verticalRange = Math.max(0, wallHeight - itemHeight);
    const authoredColumn = Math.max(0, Math.round(Number(object.placement?.column) || 0));
    const authoredRow = Math.max(0, Math.round(Number(object.placement?.row) || 0));
    const rowProgress = clamp(authoredRow, 0, GALLERY_POSITION_STEPS) / GALLERY_POSITION_STEPS;
    const top = wallTop + Math.round(verticalRange * rowProgress);
    const left = Math.round(originX + authoredColumn * cellSize);
    return { object, left, top, width: itemWidth, height: itemHeight };
  });

  const minimumWorldWidth = width * GALLERY_MINIMUM_SCREENS;
  const authoredRight = items.reduce((maximum, item) => Math.max(maximum, item.left + item.width), 0);
  const contentWidth = items.length ? authoredRight + Math.round(width * 0.45) : minimumWorldWidth;
  const worldWidth = Math.max(minimumWorldWidth, contentWidth);
  return { width, height, horizon, wallTop, wallHeight, sceneScale, cellSize, gridSpacing, originX, worldWidth, maxCameraX: worldWidth - width, items };
}

export function galleryPlacementFromPoint({ worldX, viewportY, span }, layout) {
  const columns = clamp(Math.round(Number(span?.columns) || 4), 2, 12);
  const rows = clamp(Math.round(Number(span?.rows) || 4), 2, 12);
  const cellSize = layout.cellSize || GALLERY_CELL_SIZE;
  const originX = layout.originX ?? GALLERY_ORIGIN_X;
  const { height: itemHeight } = artworkDimensions(columns, rows, layout);
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
  const { height: itemHeight } = artworkDimensions(columns, rows, layout);
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
  const { width, height } = artworkDimensions(columns, rows, layout);
  const verticalRange = Math.max(0, layout.wallHeight - height);
  const rowProgress = clamp(Math.round(Number(placement?.row) || 0), 0, GALLERY_POSITION_STEPS) / GALLERY_POSITION_STEPS;
  return {
    left: Math.round((layout.originX ?? GALLERY_ORIGIN_X) + Math.round(Number(placement?.column) || 0) * cellSize),
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
  const before = artworkMetrics(startColumns, startRows, object?.placement, layout);
  const horizontalDelta = (corner.includes('w') ? -1 : 1) * (Number(delta?.x) || 0);
  const verticalDelta = (corner.includes('n') ? -1 : 1) * (Number(delta?.y) || 0);
  const horizontalScale = (before.width + horizontalDelta) / before.width;
  const verticalScale = (before.height + verticalDelta) / before.height;
  const scale = Math.abs(horizontalScale - 1) >= Math.abs(verticalScale - 1) ? horizontalScale : verticalScale;
  const boundedScale = clamp(scale, Math.max(2 / startColumns, 2 / startRows), Math.min(12 / startColumns, 12 / startRows));
  const columnSpan = clamp(Math.round(startColumns * boundedScale), 2, 12);
  const rowSpan = clamp(Math.round(startRows * boundedScale), 2, 12);
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
