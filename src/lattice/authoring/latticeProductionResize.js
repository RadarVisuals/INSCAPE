import {
  LATTICE_PRODUCTION_GEOMETRY,
  LATTICE_PRODUCTION_VISIBILITY,
  assertValidLatticeProductionDraft,
} from '../domain/latticeProductionDraft.js';
import { projectLatticeProductionPlacement } from '../rendering/latticeProductionProjection.js';
import { sameLatticeProductionPlacementSnapshot } from './latticeProductionRemoval.js';
import { sameLatticeProductionPlacementGeometry } from './latticeProductionMovement.js';

export const LATTICE_PRODUCTION_RESIZE_CORNERS = Object.freeze(['nw', 'ne', 'se', 'sw']);
export const LATTICE_PRODUCTION_RESIZE_DEAD_ZONE = 10;

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function resizeError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

function requirePoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw resizeError('LATTICE_RESIZE_POINT_INVALID', 'Placement resize requires a finite pointer point');
  }
  return point;
}

function requireCorner(corner) {
  if (!LATTICE_PRODUCTION_RESIZE_CORNERS.includes(corner)) {
    throw resizeError('LATTICE_RESIZE_CORNER_INVALID', 'Placement resize requires a canonical corner');
  }
  return corner;
}

function requireProjection(field) {
  if (!field || !Number.isFinite(field.left) || !Number.isFinite(field.top)
    || !Number.isFinite(field.width) || field.width <= 0
    || !Number.isFinite(field.height) || field.height <= 0
    || !Number.isFinite(field.cellSize) || field.cellSize <= 0
    || field.width !== field.cellSize * LATTICE_PRODUCTION_GEOMETRY.columns
    || field.height !== field.cellSize * LATTICE_PRODUCTION_GEOMETRY.rows) {
    throw resizeError('LATTICE_RESIZE_PROJECTION_INVALID', 'Placement resize requires the canonical projected field');
  }
  return field;
}

function geometryOf(placement) {
  const geometry = {
    column: placement?.column,
    row: placement?.row,
    columnSpan: placement?.columnSpan,
    rowSpan: placement?.rowSpan,
  };
  if (!Number.isSafeInteger(geometry.column) || geometry.column < 0
    || !Number.isSafeInteger(geometry.row) || geometry.row < 0
    || !Number.isSafeInteger(geometry.columnSpan) || geometry.columnSpan < 1
    || !Number.isSafeInteger(geometry.rowSpan) || geometry.rowSpan < 1
    || geometry.column + geometry.columnSpan > LATTICE_PRODUCTION_GEOMETRY.columns
    || geometry.row + geometry.rowSpan > LATTICE_PRODUCTION_GEOMETRY.rows) {
    throw resizeError('LATTICE_RESIZE_GEOMETRY_INVALID', 'Placement resize requires bounded integer geometry');
  }
  return geometry;
}

export function latticeProductionPlacementBoundaries(placement) {
  const geometry = geometryOf(placement);
  return Object.freeze({
    top: geometry.row === 0,
    right: geometry.column + geometry.columnSpan === LATTICE_PRODUCTION_GEOMETRY.columns,
    bottom: geometry.row + geometry.rowSpan === LATTICE_PRODUCTION_GEOMETRY.rows,
    left: geometry.column === 0,
  });
}

export function latticeProductionTopBoundaryRemoveDock(placement, cellSize) {
  const geometry = geometryOf(placement);
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    throw resizeError('LATTICE_RESIZE_PROJECTION_INVALID', 'Placement controls require a positive projected cell size');
  }
  if (geometry.row !== 0) return Object.freeze({ side: null, maximumWidth: null });
  const left = geometry.column * cellSize;
  const right = (LATTICE_PRODUCTION_GEOMETRY.columns - geometry.column - geometry.columnSpan) * cellSize;
  if (left <= 9 && right <= 9) {
    return Object.freeze({ side: 'inside', maximumWidth: geometry.columnSpan * cellSize });
  }
  const side = right >= left ? 'right' : 'left';
  return Object.freeze({ side, maximumWidth: Math.max(1, (side === 'right' ? right : left) - 9) });
}

function roundedCellDelta(pixels, cellSize) {
  const cells = pixels / cellSize;
  return cells < 0 ? Math.ceil(cells - 0.5) : Math.floor(cells + 0.5);
}

function resizedGeometry(start, corner, columnDelta, rowDelta) {
  const west = start.column;
  const east = start.column + start.columnSpan;
  const north = start.row;
  const south = start.row + start.rowSpan;
  const movingWest = corner.includes('w');
  const movingNorth = corner.includes('n');
  const nextWest = movingWest ? clamp(west + columnDelta, 0, east - 1) : west;
  const nextEast = movingWest ? east : clamp(east + columnDelta, west + 1, LATTICE_PRODUCTION_GEOMETRY.columns);
  const nextNorth = movingNorth ? clamp(north + rowDelta, 0, south - 1) : north;
  const nextSouth = movingNorth ? south : clamp(south + rowDelta, north + 1, LATTICE_PRODUCTION_GEOMETRY.rows);
  return {
    column: nextWest,
    row: nextNorth,
    columnSpan: nextEast - nextWest,
    rowSpan: nextSouth - nextNorth,
  };
}

export function createLatticeProductionResizeGesture(placement, cornerInput, fieldInput, pointInput) {
  const corner = requireCorner(cornerInput);
  const field = requireProjection(fieldInput);
  const point = requirePoint(pointInput);
  const startGeometry = geometryOf(placement);
  const rectangle = projectLatticeProductionPlacement(startGeometry, field);
  return {
    placementId: placement.id,
    corner,
    origin: { ...point },
    startRectangle: { ...rectangle },
    startGeometry: { ...startGeometry },
    previewGeometry: { ...startGeometry },
    activated: false,
  };
}

export function updateLatticeProductionResizeGesture(
  gesture,
  pointInput,
  fieldInput,
  deadZone = LATTICE_PRODUCTION_RESIZE_DEAD_ZONE,
) {
  const point = requirePoint(pointInput);
  const field = requireProjection(fieldInput);
  if (!Number.isFinite(deadZone) || deadZone < 0) {
    throw resizeError('LATTICE_RESIZE_DEAD_ZONE_INVALID', 'Placement resize requires a non-negative dead zone');
  }
  const delta = { x: point.x - gesture.origin.x, y: point.y - gesture.origin.y };
  const activated = gesture.activated || Math.hypot(delta.x, delta.y) >= deadZone;
  if (!activated) return { ...gesture, activated: false };
  return {
    ...gesture,
    activated: true,
    previewGeometry: resizedGeometry(
      gesture.startGeometry,
      gesture.corner,
      roundedCellDelta(delta.x, field.cellSize),
      roundedCellDelta(delta.y, field.cellSize),
    ),
  };
}

export function finishLatticeProductionResizeGesture(gesture, { cancelled = false } = {}) {
  const geometry = cancelled ? gesture?.startGeometry : gesture?.previewGeometry;
  return {
    committed: Boolean(gesture?.activated && !cancelled
      && !sameLatticeProductionPlacementGeometry(gesture.startGeometry, geometry)),
    geometry: geometry ? { ...geometry } : null,
  };
}

export function nudgeLatticeProductionResizeGeometry(placement, cornerInput, delta) {
  const corner = requireCorner(cornerInput);
  const start = geometryOf(placement);
  if (!delta || !Number.isSafeInteger(delta.column) || !Number.isSafeInteger(delta.row)) {
    throw resizeError('LATTICE_RESIZE_DELTA_INVALID', 'Placement resize requires an integer cell delta');
  }
  const geometry = resizedGeometry(start, corner, delta.column, delta.row);
  return sameLatticeProductionPlacementGeometry(start, geometry) ? null : geometry;
}

function oppositeAnchor(geometry, corner) {
  return {
    column: corner.includes('w') ? geometry.column + geometry.columnSpan : geometry.column,
    row: corner.includes('n') ? geometry.row + geometry.rowSpan : geometry.row,
  };
}

export function createLatticeProductionResizeCandidate(draftInput, {
  corner,
  destination,
  expectedPlacement,
  placementId,
  tableId,
} = {}) {
  const draft = assertValidLatticeProductionDraft(draftInput);
  requireCorner(corner);
  const table = draft.tables.find((candidate) => candidate.id === tableId);
  if (!table) throw resizeError('LATTICE_RESIZE_TABLE_UNKNOWN', 'The active canonical table does not exist');
  if (table.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
    throw resizeError('LATTICE_RESIZE_TABLE_PRIVATE', 'Placement resize is unavailable on a private table');
  }
  const placement = table.placements.find((candidate) => candidate.id === placementId);
  if (!placement) throw resizeError('LATTICE_RESIZE_PLACEMENT_UNKNOWN', 'The canonical placement does not exist');
  if (!sameLatticeProductionPlacementSnapshot(placement, expectedPlacement)) {
    throw resizeError('LATTICE_RESIZE_PLACEMENT_STALE', 'The canonical placement changed before resize completed');
  }
  if (placement.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
    throw resizeError('LATTICE_RESIZE_PLACEMENT_PRIVATE', 'Private placements cannot be resized through the public owner projection');
  }
  if (placement.locked) throw resizeError('LATTICE_RESIZE_PLACEMENT_LOCKED', 'The canonical placement is locked');
  const start = geometryOf(placement);
  const next = geometryOf(destination);
  if (oppositeAnchor(start, corner).column !== oppositeAnchor(next, corner).column
    || oppositeAnchor(start, corner).row !== oppositeAnchor(next, corner).row) {
    throw resizeError('LATTICE_RESIZE_ANCHOR_CHANGED', 'Placement resize must preserve the opposite corner');
  }
  if (sameLatticeProductionPlacementGeometry(start, next)) return null;
  Object.assign(placement, next);
  return assertValidLatticeProductionDraft(draft);
}
