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

export function latticeProductionGroupBounds(placementsInput) {
  const placements = Array.isArray(placementsInput) ? placementsInput : [];
  if (!placements.length) throw resizeError('LATTICE_RESIZE_GROUP_EMPTY', 'Group resize requires placements');
  const geometries = placements.map(geometryOf);
  const west = Math.min(...geometries.map(({ column }) => column));
  const north = Math.min(...geometries.map(({ row }) => row));
  const east = Math.max(...geometries.map(({ column, columnSpan }) => column + columnSpan));
  const south = Math.max(...geometries.map(({ row, rowSpan }) => row + rowSpan));
  return Object.freeze({ column: west, row: north, columnSpan: east - west, rowSpan: south - north });
}

function scaleGroupAxis(start, destination, position, span, axis, spanAxis) {
  const startEnd = start[axis] + start[spanAxis];
  const destinationEnd = destination[axis] + destination[spanAxis];
  let nextStart = destination[axis] + Math.round(
    ((position - start[axis]) / start[spanAxis]) * destination[spanAxis],
  );
  let nextEnd = destination[axis] + Math.round(
    (((position + span) - start[axis]) / start[spanAxis]) * destination[spanAxis],
  );
  if (position === start[axis]) nextStart = destination[axis];
  if (position + span === startEnd) nextEnd = destinationEnd;
  nextStart = clamp(nextStart, destination[axis], destinationEnd - 1);
  nextEnd = clamp(nextEnd, nextStart + 1, destinationEnd);
  return { position: nextStart, span: nextEnd - nextStart };
}

export function resizeLatticeProductionGroupGeometries(placementsInput, destinationInput) {
  const placements = Array.isArray(placementsInput) ? placementsInput : [];
  if (!placements.length) throw resizeError('LATTICE_RESIZE_GROUP_EMPTY', 'Group resize requires placements');
  const destination = geometryOf(destinationInput);
  const start = latticeProductionGroupBounds(placements);
  return placements.map((placement) => {
    const geometry = geometryOf(placement);
    const horizontal = scaleGroupAxis(
      start, destination, geometry.column, geometry.columnSpan, 'column', 'columnSpan',
    );
    const vertical = scaleGroupAxis(start, destination, geometry.row, geometry.rowSpan, 'row', 'rowSpan');
    return Object.freeze({
      placementId: placement.id,
      destination: Object.freeze({
        column: horizontal.position,
        row: vertical.position,
        columnSpan: horizontal.span,
        rowSpan: vertical.span,
      }),
    });
  });
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

export function createLatticeProductionGroupResizeGesture(placementsInput, cornerInput, fieldInput, pointInput) {
  const placements = Array.isArray(placementsInput) ? placementsInput : [];
  if (placements.length < 2) throw resizeError('LATTICE_RESIZE_GROUP_TOO_SMALL', 'Group resize requires multiple placements');
  const ids = placements.map(({ id }) => id);
  if (ids.some((id) => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) {
    throw resizeError('LATTICE_RESIZE_GROUP_INVALID', 'Group resize requires unique canonical placement ids');
  }
  const expectedPlacements = placements.map((placement) => structuredClone(placement));
  const frameGesture = createLatticeProductionResizeGesture(
    { id: ids.at(-1), ...latticeProductionGroupBounds(placements) }, cornerInput, fieldInput, pointInput,
  );
  return {
    activated: false,
    corner: frameGesture.corner,
    expectedPlacements,
    frameGesture,
    placementIds: ids,
    previewDestinations: resizeLatticeProductionGroupGeometries(placements, frameGesture.startGeometry),
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

export function updateLatticeProductionGroupResizeGesture(gesture, pointInput, fieldInput, deadZone) {
  const frameGesture = updateLatticeProductionResizeGesture(gesture.frameGesture, pointInput, fieldInput, deadZone);
  return {
    ...gesture,
    activated: frameGesture.activated,
    frameGesture,
    previewDestinations: resizeLatticeProductionGroupGeometries(
      gesture.expectedPlacements,
      frameGesture.previewGeometry,
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

export function finishLatticeProductionGroupResizeGesture(gesture, { cancelled = false } = {}) {
  const destinations = cancelled
    ? resizeLatticeProductionGroupGeometries(gesture.expectedPlacements, gesture.frameGesture.startGeometry)
    : gesture.previewDestinations;
  return {
    committed: Boolean(gesture?.activated && !cancelled
      && destinations.some(({ placementId, destination }) => {
        const start = gesture.expectedPlacements.find(({ id }) => id === placementId);
        return start && !sameLatticeProductionPlacementGeometry(start, destination);
      })),
    destinations: destinations.map(({ placementId, destination }) => ({ placementId, destination: { ...destination } })),
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

export function nudgeLatticeProductionGroupResizeGeometries(placements, cornerInput, delta) {
  const corner = requireCorner(cornerInput);
  if (!delta || !Number.isSafeInteger(delta.column) || !Number.isSafeInteger(delta.row)) {
    throw resizeError('LATTICE_RESIZE_DELTA_INVALID', 'Group resize requires an integer cell delta');
  }
  const start = latticeProductionGroupBounds(placements);
  const destination = resizedGeometry(start, corner, delta.column, delta.row);
  if (sameLatticeProductionPlacementGeometry(start, destination)) return null;
  return resizeLatticeProductionGroupGeometries(placements, destination);
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


export function createLatticeProductionGroupResizeCandidate(draftInput, {
  corner,
  destinations,
  expectedPlacements,
  placementIds,
  tableId,
} = {}) {
  const draft = assertValidLatticeProductionDraft(draftInput);
  requireCorner(corner);
  const table = draft.tables.find((candidate) => candidate.id === tableId);
  if (!table) throw resizeError('LATTICE_RESIZE_TABLE_UNKNOWN', 'The active canonical table does not exist');
  if (table.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
    throw resizeError('LATTICE_RESIZE_TABLE_PRIVATE', 'Group resize is unavailable on a private table');
  }
  const ids = Array.isArray(placementIds) ? placementIds : [];
  if (ids.length < 2 || new Set(ids).size !== ids.length
    || !Array.isArray(expectedPlacements) || expectedPlacements.length !== ids.length
    || !Array.isArray(destinations) || destinations.length !== ids.length) {
    throw resizeError('LATTICE_RESIZE_GROUP_INVALID', 'Group resize requires matching unique placement snapshots and destinations');
  }
  const placements = ids.map((id, index) => {
    const placement = table.placements.find((candidate) => candidate.id === id);
    if (!placement) throw resizeError('LATTICE_RESIZE_PLACEMENT_UNKNOWN', 'A canonical group placement does not exist');
    if (!sameLatticeProductionPlacementSnapshot(placement, expectedPlacements[index])) {
      throw resizeError('LATTICE_RESIZE_PLACEMENT_STALE', 'A canonical group placement changed before resize completed');
    }
    if (placement.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
      throw resizeError('LATTICE_RESIZE_PLACEMENT_PRIVATE', 'Private placements cannot be group resized');
    }
    if (placement.locked) throw resizeError('LATTICE_RESIZE_PLACEMENT_LOCKED', 'A canonical group placement is locked');
    return placement;
  });
  const destinationById = new Map(destinations.map((entry) => [entry?.placementId, entry?.destination]));
  if (destinationById.size !== ids.length || ids.some((id) => !destinationById.has(id))) {
    throw resizeError('LATTICE_RESIZE_GROUP_INVALID', 'Group resize destinations must match the complete selection');
  }
  const nextGeometries = ids.map((id) => ({ placementId: id, destination: geometryOf(destinationById.get(id)) }));
  const startBounds = latticeProductionGroupBounds(placements);
  const destinationBounds = latticeProductionGroupBounds(nextGeometries.map(({ placementId, destination }) => ({
    id: placementId, ...destination,
  })));
  if (oppositeAnchor(startBounds, corner).column !== oppositeAnchor(destinationBounds, corner).column
    || oppositeAnchor(startBounds, corner).row !== oppositeAnchor(destinationBounds, corner).row) {
    throw resizeError('LATTICE_RESIZE_ANCHOR_CHANGED', 'Group resize must preserve the opposite corner');
  }
  const canonical = resizeLatticeProductionGroupGeometries(placements, destinationBounds);
  if (canonical.some((entry, index) => entry.placementId !== nextGeometries[index].placementId
    || !sameLatticeProductionPlacementGeometry(entry.destination, nextGeometries[index].destination))) {
    throw resizeError('LATTICE_RESIZE_GROUP_INVALID', 'Group resize destinations must share one canonical transform');
  }
  if (canonical.every(({ placementId, destination }) => sameLatticeProductionPlacementGeometry(
    placements.find(({ id }) => id === placementId), destination,
  ))) return null;
  for (const { placementId, destination } of canonical) {
    Object.assign(placements.find(({ id }) => id === placementId), destination);
  }
  return assertValidLatticeProductionDraft(draft);
}
