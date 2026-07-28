import {
  CANONICAL_LATTICE_ARTBOARD,
  MAX_TABLE_LABEL_OFFSET_CELLS,
  TABLE_LABEL_ANCHORS,
} from '../domain/latticeProfile.js';

export const LATTICE_GEOMETRY_PRESETS = Object.freeze([
  Object.freeze({ id: '32x18', label: '32 × 18 / 16:9 STUDY', geometry: Object.freeze({ columns: 32, rows: 18 }) }),
]);
export const PROTOTYPE_START_GEOMETRY = LATTICE_GEOMETRY_PRESETS[0].geometry;

export const LATTICE_SURFACES = Object.freeze([
  Object.freeze({ color: '#0b0c0c', id: 'carbon', label: 'CARBON 02' }),
  Object.freeze({ color: '#383a3a', id: 'graphite', label: 'GRAPHITE 02B' }),
  Object.freeze({ color: '#7b7b7b', id: 'slate', label: 'SLATE 03' }),
  Object.freeze({ color: '#b2b2b2', id: 'ash', label: 'ASH 04' }),
  Object.freeze({ color: '#c9c6bd', id: 'mist', label: 'MIST 05' }),
  Object.freeze({ color: '#d8d4ca', id: 'paper', label: 'PAPER' }),
]);
export const AUTO_LATTICE_OVERLAY_INK = 'auto';

const SURFACE_IDS = new Set(LATTICE_SURFACES.map(({ id }) => id));
const ANCHORS = new Set(TABLE_LABEL_ANCHORS);
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const LATTICE_ARTBOARD_FITS = Object.freeze({
  CONTAIN: 'contain',
  COVER: 'cover',
});

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

export function latticeSurfaceColor(surfaceId) {
  return LATTICE_SURFACES.find(({ id }) => id === surfaceId)?.color || null;
}

function boundedOffset(value, dimension) {
  const semanticMaximum = Math.min(MAX_TABLE_LABEL_OFFSET_CELLS, dimension - 1);
  return clamp(Number.isSafeInteger(value) ? value : 0, -semanticMaximum, semanticMaximum);
}

export function projectTableLabelPosition(table, geometry, viewport, artboard = CANONICAL_LATTICE_ARTBOARD, framing) {
  assertRenderGeometry(geometry);
  const field = projectCanonicalLatticeArtboard(artboard, viewport, framing);
  const cellSize = Math.min(field.width / geometry.columns, field.height / geometry.rows);
  const anchor = ANCHORS.has(table?.labelAnchor) ? table.labelAnchor : 'top-left';
  const [vertical, horizontal] = anchor.split('-');
  const columnOffset = boundedOffset(table?.labelOffset?.column, geometry.columns);
  const rowOffset = boundedOffset(table?.labelOffset?.row, geometry.rows);
  const baseX = horizontal === 'left' ? field.left + cellSize : horizontal === 'right' ? field.left + field.width - cellSize : viewport.width / 2;
  const baseY = vertical === 'top' ? field.top + cellSize : field.top + field.height - cellSize;
  const x = clamp(baseX + (columnOffset * cellSize), 0, viewport.width);
  const y = clamp(baseY + (rowOffset * cellSize), 0, viewport.height);
  const translateX = horizontal === 'left' ? '0%' : horizontal === 'right' ? '-100%' : '-50%';
  const translateY = vertical === 'top' ? '0%' : '-100%';

  return {
    left: `${x}px`,
    top: `${y}px`,
    transform: `translate(${translateX}, ${translateY})`,
  };
}

export function latticeArtboardFramingBounds(artboard, viewport, fit = LATTICE_ARTBOARD_FITS.CONTAIN) {
  const centered = projectCanonicalLatticeArtboard(artboard, viewport, { fit, offset: { x: 0, y: 0 } });
  return {
    x: Math.max(0, (centered.width - viewport.width) / 2),
    y: Math.max(0, (centered.height - viewport.height) / 2),
  };
}

export function clampLatticeArtboardOffset(offset, bounds) {
  return {
    x: clamp(Number.isFinite(offset?.x) ? offset.x : 0, -bounds.x, bounds.x),
    y: clamp(Number.isFinite(offset?.y) ? offset.y : 0, -bounds.y, bounds.y),
  };
}

export function projectCanonicalLatticeArtboard(artboard, viewport, framing = {}) {
  if (!artboard
    || !Number.isFinite(artboard.aspectWidth) || artboard.aspectWidth <= 0
    || !Number.isFinite(artboard.aspectHeight) || artboard.aspectHeight <= 0) {
    throw new TypeError('Lattice rendering requires a positive artboard aspect ratio');
  }
  if (!viewport
    || !Number.isFinite(viewport.width) || viewport.width <= 0
    || !Number.isFinite(viewport.height) || viewport.height <= 0) {
    throw new TypeError('Lattice rendering requires a positive viewport');
  }
  const fit = framing.fit === LATTICE_ARTBOARD_FITS.COVER
    ? LATTICE_ARTBOARD_FITS.COVER
    : LATTICE_ARTBOARD_FITS.CONTAIN;
  const scaleOperation = fit === LATTICE_ARTBOARD_FITS.COVER ? Math.max : Math.min;
  const scale = scaleOperation(viewport.width / artboard.aspectWidth, viewport.height / artboard.aspectHeight);
  const width = artboard.aspectWidth * scale;
  const height = artboard.aspectHeight * scale;
  const offset = clampLatticeArtboardOffset(framing.offset, {
    x: Math.max(0, (width - viewport.width) / 2),
    y: Math.max(0, (height - viewport.height) / 2),
  });
  return {
    width,
    height,
    left: ((viewport.width - width) / 2) + offset.x,
    top: ((viewport.height - height) / 2) + offset.y,
  };
}

export function projectPlacementRectangle(placement, artboard, viewport, framing) {
  const field = projectCanonicalLatticeArtboard(artboard, viewport, framing);
  return {
    left: field.left + (placement.x * field.width),
    top: field.top + (placement.y * field.height),
    width: placement.width * field.width,
    height: placement.height * field.height,
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

export function semanticGridVariables(geometry, viewport, stageOrigin = { x: 0, y: 0 }, artboard = CANONICAL_LATTICE_ARTBOARD, framing) {
  assertRenderGeometry(geometry);
  const field = projectCanonicalLatticeArtboard(artboard, viewport, framing);
  const cellSize = Math.min(field.width / geometry.columns, field.height / geometry.rows);
  return {
    '--lattice-grid-columns': geometry.columns,
    '--lattice-grid-rows': geometry.rows,
    '--lattice-grid-cell-size': `${cellSize}px`,
    '--lattice-grid-origin-x': `${(stageOrigin?.x || 0) + field.left}px`,
    '--lattice-grid-origin-y': `${(stageOrigin?.y || 0) + field.top}px`,
  };
}
