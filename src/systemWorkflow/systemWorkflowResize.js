import {
  SYSTEM_WORKFLOW_WORLD_BOUNDS,
  SYSTEM_WORKFLOW_VISIBILITY,
  assertValidSystemWorkflowDraft,
  isSystemWorkflowGridCoordinate,
  isValidSystemWorkflowPlacementGeometry,
  quantizeSystemWorkflowGridCoordinate,
} from './domain/systemWorkflowDraft.js';
import { projectLatticeProductionPlacement as projectSystemWorkflowPlacement } from '../lattice/rendering/latticeProductionProjection.js';
import { sameSystemWorkflowPlacementSnapshot } from './systemWorkflowRemoval.js';
import { sameSystemWorkflowPlacementGeometry } from './systemWorkflowMovement.js';

export const SYSTEM_WORKFLOW_RESIZE_CORNERS = Object.freeze(['nw', 'ne', 'se', 'sw']);
export const SYSTEM_WORKFLOW_RESIZE_DEAD_ZONE = 10;

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const snapStepOf = (field) => isSystemWorkflowGridCoordinate(field?.snapStep) && field.snapStep > 0 ? field.snapStep : 1;
const snapCell = (value, step) => quantizeSystemWorkflowGridCoordinate(Math.round(value / step) * step);

function resizeError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

function requirePoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_POINT_INVALID', 'Placement resize requires a finite pointer point');
  }
  return point;
}

function requireCorner(corner) {
  if (!SYSTEM_WORKFLOW_RESIZE_CORNERS.includes(corner)) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_CORNER_INVALID', 'Placement resize requires a canonical corner');
  }
  return corner;
}

function requireProjection(field) {
  if (!field || !Number.isFinite(field.left) || !Number.isFinite(field.top)
    || !Number.isFinite(field.width) || field.width <= 0
    || !Number.isFinite(field.height) || field.height <= 0
    || !Number.isFinite(field.cellSize) || field.cellSize <= 0) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_PROJECTION_INVALID', 'Placement resize requires the canonical projected field');
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
  if (!isValidSystemWorkflowPlacementGeometry(geometry)) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_GEOMETRY_INVALID', 'Placement resize requires bounded world geometry');
  }
  return geometry;
}

export function systemWorkflowGroupBounds(placementsInput) {
  const placements = Array.isArray(placementsInput) ? placementsInput : [];
  if (!placements.length) throw resizeError('SYSTEM_WORKFLOW_RESIZE_GROUP_EMPTY', 'Group resize requires placements');
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
  let nextStart = destination[axis] + quantizeSystemWorkflowGridCoordinate(
    ((position - start[axis]) / start[spanAxis]) * destination[spanAxis],
  );
  let nextEnd = destination[axis] + quantizeSystemWorkflowGridCoordinate(
    (((position + span) - start[axis]) / start[spanAxis]) * destination[spanAxis],
  );
  if (position === start[axis]) nextStart = destination[axis];
  if (position + span === startEnd) nextEnd = destinationEnd;
  nextStart = clamp(nextStart, destination[axis], destinationEnd - 1);
  nextEnd = clamp(nextEnd, nextStart + 1, destinationEnd);
  return { position: nextStart, span: nextEnd - nextStart };
}

export function resizeSystemWorkflowGroupGeometries(placementsInput, destinationInput) {
  const placements = Array.isArray(placementsInput) ? placementsInput : [];
  if (!placements.length) throw resizeError('SYSTEM_WORKFLOW_RESIZE_GROUP_EMPTY', 'Group resize requires placements');
  const destination = geometryOf(destinationInput);
  const start = systemWorkflowGroupBounds(placements);
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

export function systemWorkflowPlacementBoundaries(placement) {
  const geometry = geometryOf(placement);
  return Object.freeze({
    top: geometry.row === SYSTEM_WORKFLOW_WORLD_BOUNDS.minimumRow,
    right: geometry.column + geometry.columnSpan === SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumColumn,
    bottom: geometry.row + geometry.rowSpan === SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumRow,
    left: geometry.column === SYSTEM_WORKFLOW_WORLD_BOUNDS.minimumColumn,
  });
}

export function systemWorkflowTopBoundaryRemoveDock(placement, cellSize) {
  const geometry = geometryOf(placement);
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_PROJECTION_INVALID', 'Placement controls require a positive projected cell size');
  }
  if (geometry.row !== SYSTEM_WORKFLOW_WORLD_BOUNDS.minimumRow) return Object.freeze({ side: null, maximumWidth: null });
  const left = (geometry.column - SYSTEM_WORKFLOW_WORLD_BOUNDS.minimumColumn) * cellSize;
  const right = (SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumColumn - geometry.column - geometry.columnSpan) * cellSize;
  if (left <= 9 && right <= 9) {
    return Object.freeze({ side: 'inside', maximumWidth: geometry.columnSpan * cellSize });
  }
  const side = right >= left ? 'right' : 'left';
  return Object.freeze({ side, maximumWidth: Math.max(1, (side === 'right' ? right : left) - 9) });
}

function resizedGeometry(start, corner, columnDelta, rowDelta) {
  const west = start.column;
  const east = start.column + start.columnSpan;
  const north = start.row;
  const south = start.row + start.rowSpan;
  const movingWest = corner.includes('w');
  const movingNorth = corner.includes('n');
  const nextWest = movingWest
    ? clamp(west + columnDelta, Math.max(SYSTEM_WORKFLOW_WORLD_BOUNDS.minimumColumn,
      east - SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumSpan), east - 1)
    : west;
  const nextEast = movingWest
    ? east
    : clamp(east + columnDelta, west + 1, Math.min(SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumColumn,
      west + SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumSpan));
  const nextNorth = movingNorth
    ? clamp(north + rowDelta, Math.max(SYSTEM_WORKFLOW_WORLD_BOUNDS.minimumRow,
      south - SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumSpan), south - 1)
    : north;
  const nextSouth = movingNorth
    ? south
    : clamp(south + rowDelta, north + 1, Math.min(SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumRow,
      north + SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumSpan));
  return {
    column: nextWest,
    row: nextNorth,
    columnSpan: nextEast - nextWest,
    rowSpan: nextSouth - nextNorth,
  };
}

function ratioPreservingGeometry(start, corner, columnDelta, rowDelta) {
  const east = start.column + start.columnSpan;
  const south = start.row + start.rowSpan;
  const movingWest = corner.includes('w');
  const movingNorth = corner.includes('n');
  const maximumWidth = Math.min(SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumSpan,
    movingWest ? east - SYSTEM_WORKFLOW_WORLD_BOUNDS.minimumColumn : SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumColumn - start.column);
  const maximumHeight = Math.min(SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumSpan,
    movingNorth ? south - SYSTEM_WORKFLOW_WORLD_BOUNDS.minimumRow : SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumRow - start.row);
  const requestedWidth = clamp(start.columnSpan + (movingWest ? -columnDelta : columnDelta), 1, maximumWidth);
  const requestedHeight = clamp(start.rowSpan + (movingNorth ? -rowDelta : rowDelta), 1, maximumHeight);
  const ratio = start.columnSpan / start.rowSpan;
  let columnSpan;
  let rowSpan;
  if (Math.abs(columnDelta) >= Math.abs(rowDelta)) {
    columnSpan = requestedWidth;
    rowSpan = clamp(quantizeSystemWorkflowGridCoordinate(columnSpan / ratio), 1, maximumHeight);
    if (rowSpan === maximumHeight) columnSpan = clamp(quantizeSystemWorkflowGridCoordinate(rowSpan * ratio), 1, maximumWidth);
  } else {
    rowSpan = requestedHeight;
    columnSpan = clamp(quantizeSystemWorkflowGridCoordinate(rowSpan * ratio), 1, maximumWidth);
    if (columnSpan === maximumWidth) rowSpan = clamp(quantizeSystemWorkflowGridCoordinate(columnSpan / ratio), 1, maximumHeight);
  }
  return {
    column: movingWest ? east - columnSpan : start.column,
    row: movingNorth ? south - rowSpan : start.row,
    columnSpan,
    rowSpan,
  };
}

export function createSystemWorkflowResizeGesture(placement, cornerInput, fieldInput, pointInput) {
  const corner = requireCorner(cornerInput);
  const field = requireProjection(fieldInput);
  const point = requirePoint(pointInput);
  const startGeometry = geometryOf(placement);
  const rectangle = projectSystemWorkflowPlacement(startGeometry, field);
  const movingBoundary = {
    column: corner.includes('w') ? startGeometry.column : startGeometry.column + startGeometry.columnSpan,
    row: corner.includes('n') ? startGeometry.row : startGeometry.row + startGeometry.rowSpan,
  };
  return {
    placementId: placement.id,
    corner,
    origin: { ...point },
    grabOffset: {
      column: (point.x - field.left) / field.cellSize - movingBoundary.column,
      row: (point.y - field.top) / field.cellSize - movingBoundary.row,
    },
    movingBoundary,
    startRectangle: { ...rectangle },
    startGeometry: { ...startGeometry },
    previewGeometry: { ...startGeometry },
    activated: false,
  };
}

export function createSystemWorkflowGroupResizeGesture(placementsInput, cornerInput, fieldInput, pointInput) {
  const placements = Array.isArray(placementsInput) ? placementsInput : [];
  if (placements.length < 2) throw resizeError('SYSTEM_WORKFLOW_RESIZE_GROUP_TOO_SMALL', 'Group resize requires multiple placements');
  const ids = placements.map(({ id }) => id);
  if (ids.some((id) => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_GROUP_INVALID', 'Group resize requires unique canonical placement ids');
  }
  const expectedPlacements = placements.map((placement) => structuredClone(placement));
  const frameGesture = createSystemWorkflowResizeGesture(
    { id: ids.at(-1), ...systemWorkflowGroupBounds(placements) }, cornerInput, fieldInput, pointInput,
  );
  return {
    activated: false,
    corner: frameGesture.corner,
    expectedPlacements,
    frameGesture,
    placementIds: ids,
    previewDestinations: resizeSystemWorkflowGroupGeometries(placements, frameGesture.startGeometry),
  };
}

export function updateSystemWorkflowResizeGesture(
  gesture,
  pointInput,
  fieldInput,
  deadZone = SYSTEM_WORKFLOW_RESIZE_DEAD_ZONE,
  { preserveRatio = false } = {},
) {
  const point = requirePoint(pointInput);
  const field = requireProjection(fieldInput);
  if (!Number.isFinite(deadZone) || deadZone < 0) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_DEAD_ZONE_INVALID', 'Placement resize requires a non-negative dead zone');
  }
  const delta = { x: point.x - gesture.origin.x, y: point.y - gesture.origin.y };
  const activated = gesture.activated || Math.hypot(delta.x, delta.y) >= deadZone;
  if (!activated) return { ...gesture, activated: false };
  const snapStep = snapStepOf(field);
  const movingColumn = snapCell(
    (point.x - field.left) / field.cellSize - gesture.grabOffset.column,
    snapStep,
  );
  const movingRow = snapCell(
    (point.y - field.top) / field.cellSize - gesture.grabOffset.row,
    snapStep,
  );
  return {
    ...gesture,
    activated: true,
    previewGeometry: (preserveRatio ? ratioPreservingGeometry : resizedGeometry)(
      gesture.startGeometry,
      gesture.corner,
      quantizeSystemWorkflowGridCoordinate(movingColumn - gesture.movingBoundary.column),
      quantizeSystemWorkflowGridCoordinate(movingRow - gesture.movingBoundary.row),
    ),
  };
}

export function updateSystemWorkflowGroupResizeGesture(gesture, pointInput, fieldInput, deadZone) {
  const frameGesture = updateSystemWorkflowResizeGesture(gesture.frameGesture, pointInput, fieldInput, deadZone);
  return {
    ...gesture,
    activated: frameGesture.activated,
    frameGesture,
    previewDestinations: resizeSystemWorkflowGroupGeometries(
      gesture.expectedPlacements,
      frameGesture.previewGeometry,
    ),
  };
}

export function finishSystemWorkflowResizeGesture(gesture, { cancelled = false } = {}) {
  const geometry = cancelled ? gesture?.startGeometry : gesture?.previewGeometry;
  return {
    committed: Boolean(gesture?.activated && !cancelled
      && !sameSystemWorkflowPlacementGeometry(gesture.startGeometry, geometry)),
    geometry: geometry ? { ...geometry } : null,
  };
}

export function finishSystemWorkflowGroupResizeGesture(gesture, { cancelled = false } = {}) {
  const destinations = cancelled
    ? resizeSystemWorkflowGroupGeometries(gesture.expectedPlacements, gesture.frameGesture.startGeometry)
    : gesture.previewDestinations;
  return {
    committed: Boolean(gesture?.activated && !cancelled
      && destinations.some(({ placementId, destination }) => {
        const start = gesture.expectedPlacements.find(({ id }) => id === placementId);
        return start && !sameSystemWorkflowPlacementGeometry(start, destination);
      })),
    destinations: destinations.map(({ placementId, destination }) => ({ placementId, destination: { ...destination } })),
  };
}

export function nudgeSystemWorkflowResizeGeometry(placement, cornerInput, delta) {
  const corner = requireCorner(cornerInput);
  const start = geometryOf(placement);
  if (!delta || !isSystemWorkflowGridCoordinate(delta.column) || !isSystemWorkflowGridCoordinate(delta.row)) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_DELTA_INVALID', 'Placement resize requires a grid-precision delta');
  }
  const geometry = resizedGeometry(start, corner, delta.column, delta.row);
  return sameSystemWorkflowPlacementGeometry(start, geometry) ? null : geometry;
}

export function nudgeSystemWorkflowGroupResizeGeometries(placements, cornerInput, delta) {
  const corner = requireCorner(cornerInput);
  if (!delta || !isSystemWorkflowGridCoordinate(delta.column) || !isSystemWorkflowGridCoordinate(delta.row)) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_DELTA_INVALID', 'Group resize requires a grid-precision delta');
  }
  const start = systemWorkflowGroupBounds(placements);
  const destination = resizedGeometry(start, corner, delta.column, delta.row);
  if (sameSystemWorkflowPlacementGeometry(start, destination)) return null;
  return resizeSystemWorkflowGroupGeometries(placements, destination);
}

function oppositeAnchor(geometry, corner) {
  return {
    column: corner.includes('w') ? geometry.column + geometry.columnSpan : geometry.column,
    row: corner.includes('n') ? geometry.row + geometry.rowSpan : geometry.row,
  };
}

export function createSystemWorkflowResizeCandidate(draftInput, {
  corner,
  destination,
  expectedPlacement,
  placementId,
  gridId,
} = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  requireCorner(corner);
  const grid = draft.grids.find((candidate) => candidate.id === gridId);
  if (!grid) throw resizeError('SYSTEM_WORKFLOW_RESIZE_GRID_UNKNOWN', 'The active canonical grid does not exist');
  if (grid.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_GRID_PRIVATE', 'Placement resize is unavailable on a private grid');
  }
  const placement = grid.placements.find((candidate) => candidate.id === placementId);
  if (!placement) throw resizeError('SYSTEM_WORKFLOW_RESIZE_PLACEMENT_UNKNOWN', 'The canonical placement does not exist');
  if (!sameSystemWorkflowPlacementSnapshot(placement, expectedPlacement)) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_PLACEMENT_STALE', 'The canonical placement changed before resize completed');
  }
  if (placement.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_PLACEMENT_PRIVATE', 'Private placements cannot be resized through the public owner projection');
  }
  if (placement.locked) throw resizeError('SYSTEM_WORKFLOW_RESIZE_PLACEMENT_LOCKED', 'The canonical placement is locked');
  const start = geometryOf(placement);
  const next = geometryOf(destination);
  if (oppositeAnchor(start, corner).column !== oppositeAnchor(next, corner).column
    || oppositeAnchor(start, corner).row !== oppositeAnchor(next, corner).row) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_ANCHOR_CHANGED', 'Placement resize must preserve the opposite corner');
  }
  if (sameSystemWorkflowPlacementGeometry(start, next)) return null;
  Object.assign(placement, next);
  return assertValidSystemWorkflowDraft(draft);
}


export function createSystemWorkflowGroupResizeCandidate(draftInput, {
  corner,
  destinations,
  expectedPlacements,
  placementIds,
  gridId,
} = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  requireCorner(corner);
  const grid = draft.grids.find((candidate) => candidate.id === gridId);
  if (!grid) throw resizeError('SYSTEM_WORKFLOW_RESIZE_GRID_UNKNOWN', 'The active canonical grid does not exist');
  if (grid.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_GRID_PRIVATE', 'Group resize is unavailable on a private grid');
  }
  const ids = Array.isArray(placementIds) ? placementIds : [];
  if (ids.length < 2 || new Set(ids).size !== ids.length
    || !Array.isArray(expectedPlacements) || expectedPlacements.length !== ids.length
    || !Array.isArray(destinations) || destinations.length !== ids.length) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_GROUP_INVALID', 'Group resize requires matching unique placement snapshots and destinations');
  }
  const placements = ids.map((id, index) => {
    const placement = grid.placements.find((candidate) => candidate.id === id);
    if (!placement) throw resizeError('SYSTEM_WORKFLOW_RESIZE_PLACEMENT_UNKNOWN', 'A canonical group placement does not exist');
    if (!sameSystemWorkflowPlacementSnapshot(placement, expectedPlacements[index])) {
      throw resizeError('SYSTEM_WORKFLOW_RESIZE_PLACEMENT_STALE', 'A canonical group placement changed before resize completed');
    }
    if (placement.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
      throw resizeError('SYSTEM_WORKFLOW_RESIZE_PLACEMENT_PRIVATE', 'Private placements cannot be group resized');
    }
    if (placement.locked) throw resizeError('SYSTEM_WORKFLOW_RESIZE_PLACEMENT_LOCKED', 'A canonical group placement is locked');
    return placement;
  });
  const destinationById = new Map(destinations.map((entry) => [entry?.placementId, entry?.destination]));
  if (destinationById.size !== ids.length || ids.some((id) => !destinationById.has(id))) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_GROUP_INVALID', 'Group resize destinations must match the complete selection');
  }
  const nextGeometries = ids.map((id) => ({ placementId: id, destination: geometryOf(destinationById.get(id)) }));
  const startBounds = systemWorkflowGroupBounds(placements);
  const destinationBounds = systemWorkflowGroupBounds(nextGeometries.map(({ placementId, destination }) => ({
    id: placementId, ...destination,
  })));
  if (oppositeAnchor(startBounds, corner).column !== oppositeAnchor(destinationBounds, corner).column
    || oppositeAnchor(startBounds, corner).row !== oppositeAnchor(destinationBounds, corner).row) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_ANCHOR_CHANGED', 'Group resize must preserve the opposite corner');
  }
  const canonical = resizeSystemWorkflowGroupGeometries(placements, destinationBounds);
  if (canonical.some((entry, index) => entry.placementId !== nextGeometries[index].placementId
    || !sameSystemWorkflowPlacementGeometry(entry.destination, nextGeometries[index].destination))) {
    throw resizeError('SYSTEM_WORKFLOW_RESIZE_GROUP_INVALID', 'Group resize destinations must share one canonical transform');
  }
  if (canonical.every(({ placementId, destination }) => sameSystemWorkflowPlacementGeometry(
    placements.find(({ id }) => id === placementId), destination,
  ))) return null;
  for (const { placementId, destination } of canonical) {
    Object.assign(placements.find(({ id }) => id === placementId), destination);
  }
  return assertValidSystemWorkflowDraft(draft);
}
