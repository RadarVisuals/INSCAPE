import { MAX_TABLE_LABEL_OFFSET_CELLS, TABLE_LABEL_ANCHORS } from '../domain/latticeProfile.js';

export const LATTICE_GEOMETRY_PRESETS = Object.freeze([
  Object.freeze({ id: '20x20', label: '20 × 20 / SQUARE', geometry: Object.freeze({ columns: 20, rows: 20 }) }),
  Object.freeze({ id: '24x18', label: '24 × 18 / WIDE', geometry: Object.freeze({ columns: 24, rows: 18 }) }),
  Object.freeze({ id: '24x16', label: '24 × 16 / CINEMA', geometry: Object.freeze({ columns: 24, rows: 16 }) }),
]);
export const PROTOTYPE_START_GEOMETRY = LATTICE_GEOMETRY_PRESETS[2].geometry;

export const LATTICE_SURFACES = Object.freeze([
  Object.freeze({ id: 'carbon', label: 'CARBON 02' }),
  Object.freeze({ id: 'graphite', label: 'GRAPHITE 02B' }),
  Object.freeze({ id: 'slate', label: 'SLATE 03' }),
  Object.freeze({ id: 'ash', label: 'ASH 04' }),
  Object.freeze({ id: 'mist', label: 'MIST 05' }),
  Object.freeze({ id: 'paper', label: 'PAPER' }),
]);

const SURFACE_IDS = new Set(LATTICE_SURFACES.map(({ id }) => id));
const ANCHORS = new Set(TABLE_LABEL_ANCHORS);
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function assertRenderGeometry(geometry) {
  if (!geometry
    || !Number.isSafeInteger(geometry.columns) || geometry.columns < 1
    || !Number.isSafeInteger(geometry.rows) || geometry.rows < 1) {
    throw new TypeError('Lattice rendering requires positive integer columns and rows');
  }
  return geometry;
}

export function normalizeLatticeSurface(surfaceId) {
  return SURFACE_IDS.has(surfaceId) ? surfaceId : LATTICE_SURFACES[0].id;
}

function boundedOffset(value, dimension) {
  const semanticMaximum = Math.min(MAX_TABLE_LABEL_OFFSET_CELLS, dimension - 1);
  return clamp(Number.isSafeInteger(value) ? value : 0, -semanticMaximum, semanticMaximum);
}

export function projectTableLabelPosition(table, geometry, viewport) {
  assertRenderGeometry(geometry);
  const field = projectAuthoredLatticeField(geometry, viewport);
  const anchor = ANCHORS.has(table?.labelAnchor) ? table.labelAnchor : 'top-left';
  const [vertical, horizontal] = anchor.split('-');
  const columnOffset = boundedOffset(table?.labelOffset?.column, geometry.columns);
  const rowOffset = boundedOffset(table?.labelOffset?.row, geometry.rows);
  const baseX = horizontal === 'left' ? field.cellSize : horizontal === 'right' ? viewport.width - field.cellSize : viewport.width / 2;
  const baseY = vertical === 'top' ? field.cellSize : viewport.height - field.cellSize;
  const x = clamp(baseX + (columnOffset * field.cellSize), 0, viewport.width);
  const y = clamp(baseY + (rowOffset * field.cellSize), 0, viewport.height);
  const translateX = horizontal === 'left' ? '0%' : horizontal === 'right' ? '-100%' : '-50%';
  const translateY = vertical === 'top' ? '0%' : '-100%';

  return {
    left: `${x}px`,
    top: `${y}px`,
    transform: `translate(${translateX}, ${translateY})`,
  };
}

export function projectAuthoredLatticeField(geometry, viewport, coordinate = { x: 0, y: 0 }) {
  assertRenderGeometry(geometry);
  if (!viewport
    || !Number.isFinite(viewport.width) || viewport.width <= 0
    || !Number.isFinite(viewport.height) || viewport.height <= 0) {
    throw new TypeError('Lattice rendering requires a positive viewport');
  }
  const cellSize = Math.min(viewport.width / geometry.columns, viewport.height / geometry.rows);
  const width = cellSize * geometry.columns;
  const height = cellSize * geometry.rows;
  const centeredLeft = (viewport.width - width) / 2;
  const centeredTop = (viewport.height - height) / 2;
  const alignToSharedPhase = (centered, coordinateValue, viewportSize, maximum) => {
    const phase = centered - (coordinateValue * viewportSize);
    const aligned = phase + (Math.round((centered - phase) / cellSize) * cellSize);
    return clamp(aligned, 0, maximum);
  };
  return {
    cellSize,
    width,
    height,
    left: alignToSharedPhase(centeredLeft, coordinate?.x || 0, viewport.width, viewport.width - width),
    top: alignToSharedPhase(centeredTop, coordinate?.y || 0, viewport.height, viewport.height - height),
  };
}

export function projectPlacementRectangle(placement, geometry, viewport, coordinate = { x: 0, y: 0 }) {
  const field = projectAuthoredLatticeField(geometry, viewport, coordinate);
  return {
    left: field.left + (placement.column * field.cellSize),
    top: field.top + (placement.row * field.cellSize),
    width: placement.columnSpan * field.cellSize,
    height: placement.rowSpan * field.cellSize,
  };
}

export function fitNativeMediaRectangle(rectangle, media) {
  if (!rectangle
    || !Number.isFinite(rectangle.left) || !Number.isFinite(rectangle.top)
    || !Number.isFinite(rectangle.width) || rectangle.width <= 0
    || !Number.isFinite(rectangle.height) || rectangle.height <= 0
    || !media
    || !Number.isFinite(media.width) || media.width <= 0
    || !Number.isFinite(media.height) || media.height <= 0) {
    throw new TypeError('Native media fitting requires positive placement and media dimensions');
  }
  const scale = Math.min(rectangle.width / media.width, rectangle.height / media.height);
  const width = media.width * scale;
  const height = media.height * scale;
  return {
    left: rectangle.left + ((rectangle.width - width) / 2),
    top: rectangle.top + ((rectangle.height - height) / 2),
    width,
    height,
  };
}

export function semanticGridVariables(geometry, viewport, stageOrigin = { x: 0, y: 0 }) {
  const field = projectAuthoredLatticeField(geometry, viewport);
  return {
    '--lattice-grid-columns': geometry.columns,
    '--lattice-grid-rows': geometry.rows,
    '--lattice-grid-cell-size': `${field.cellSize}px`,
    '--lattice-grid-origin-x': `${(stageOrigin?.x || 0) + field.left}px`,
    '--lattice-grid-origin-y': `${(stageOrigin?.y || 0) + field.top}px`,
  };
}
