import {
  SYSTEM_WORKFLOW_GEOMETRY,
  SYSTEM_WORKFLOW_VISIBILITY,
  assertValidSystemWorkflowDraft,
} from './domain/systemWorkflowDraft.js';
import { projectLatticeProductionPlacement as projectSystemWorkflowPlacement } from '../lattice/rendering/latticeProductionProjection.js';

export const SYSTEM_WORKFLOW_MOVEMENT_DEAD_ZONE = 10;

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function movementError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

function requirePoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw movementError('SYSTEM_WORKFLOW_MOVEMENT_POINT_INVALID', 'Placement movement requires a finite pointer point');
  }
  return point;
}

function requireProjection(field) {
  if (!field || !Number.isFinite(field.left) || !Number.isFinite(field.top)
    || !Number.isFinite(field.width) || field.width <= 0
    || !Number.isFinite(field.height) || field.height <= 0
    || !Number.isFinite(field.cellSize) || field.cellSize <= 0
    || field.width !== field.cellSize * SYSTEM_WORKFLOW_GEOMETRY.columns
    || field.height !== field.cellSize * SYSTEM_WORKFLOW_GEOMETRY.rows) {
    throw movementError('SYSTEM_WORKFLOW_MOVEMENT_PROJECTION_INVALID', 'Placement movement requires the canonical projected field');
  }
  return field;
}

function placementGeometry(placement) {
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
    || geometry.column + geometry.columnSpan > SYSTEM_WORKFLOW_GEOMETRY.columns
    || geometry.row + geometry.rowSpan > SYSTEM_WORKFLOW_GEOMETRY.rows) {
    throw movementError('SYSTEM_WORKFLOW_MOVEMENT_GEOMETRY_INVALID', 'Placement movement requires bounded integer geometry');
  }
  return geometry;
}

export function sameSystemWorkflowPlacementGeometry(left, right) {
  return Boolean(left && right
    && left.column === right.column && left.row === right.row
    && left.columnSpan === right.columnSpan && left.rowSpan === right.rowSpan);
}

export function createSystemWorkflowMovementGesture(placement, fieldInput, pointInput) {
  const field = requireProjection(fieldInput);
  const point = requirePoint(pointInput);
  const startGeometry = placementGeometry(placement);
  const rectangle = projectSystemWorkflowPlacement(startGeometry, field);
  if (point.x < rectangle.left || point.x > rectangle.left + rectangle.width
    || point.y < rectangle.top || point.y > rectangle.top + rectangle.height) {
    throw movementError('SYSTEM_WORKFLOW_MOVEMENT_GRAB_OUTSIDE', 'Placement movement must begin inside the projected placement');
  }
  return {
    placementId: placement.id,
    origin: { ...point },
    grabOffset: {
      column: (point.x - rectangle.left) / field.cellSize,
      row: (point.y - rectangle.top) / field.cellSize,
    },
    startGeometry: { ...startGeometry },
    previewGeometry: { ...startGeometry },
    activated: false,
  };
}

export function updateSystemWorkflowMovementGesture(
  gesture,
  pointInput,
  fieldInput,
  deadZone = SYSTEM_WORKFLOW_MOVEMENT_DEAD_ZONE,
) {
  const point = requirePoint(pointInput);
  const field = requireProjection(fieldInput);
  if (!Number.isFinite(deadZone) || deadZone < 0) {
    throw movementError('SYSTEM_WORKFLOW_MOVEMENT_DEAD_ZONE_INVALID', 'Placement movement requires a non-negative dead zone');
  }
  const delta = { x: point.x - gesture.origin.x, y: point.y - gesture.origin.y };
  const activated = gesture.activated || Math.hypot(delta.x, delta.y) >= deadZone;
  if (!activated) return { ...gesture, activated: false };

  const pointerColumn = (point.x - field.left) / field.cellSize;
  const pointerRow = (point.y - field.top) / field.cellSize;
  const column = clamp(
    Math.floor(pointerColumn - gesture.grabOffset.column + 0.5),
    0,
    SYSTEM_WORKFLOW_GEOMETRY.columns - gesture.startGeometry.columnSpan,
  );
  const row = clamp(
    Math.floor(pointerRow - gesture.grabOffset.row + 0.5),
    0,
    SYSTEM_WORKFLOW_GEOMETRY.rows - gesture.startGeometry.rowSpan,
  );
  return {
    ...gesture,
    activated: true,
    previewGeometry: { ...gesture.startGeometry, column, row },
  };
}

export function finishSystemWorkflowMovementGesture(gesture, { cancelled = false } = {}) {
  const geometry = cancelled ? gesture?.startGeometry : gesture?.previewGeometry;
  const committed = Boolean(gesture?.activated && !cancelled
    && !sameSystemWorkflowPlacementGeometry(gesture.startGeometry, geometry));
  return { committed, geometry: geometry ? { ...geometry } : null };
}

export function nudgeSystemWorkflowPlacementGeometry(placement, delta) {
  const start = placementGeometry(placement);
  if (!delta || !Number.isSafeInteger(delta.column) || !Number.isSafeInteger(delta.row)) {
    throw movementError('SYSTEM_WORKFLOW_MOVEMENT_DELTA_INVALID', 'Placement movement requires an integer cell delta');
  }
  const geometry = {
    ...start,
    column: clamp(start.column + delta.column, 0, SYSTEM_WORKFLOW_GEOMETRY.columns - start.columnSpan),
    row: clamp(start.row + delta.row, 0, SYSTEM_WORKFLOW_GEOMETRY.rows - start.rowSpan),
  };
  return sameSystemWorkflowPlacementGeometry(start, geometry) ? null : geometry;
}

export function clampSystemWorkflowGroupDelta(placements, delta) {
  if (!Array.isArray(placements) || placements.length < 1
    || !delta || !Number.isSafeInteger(delta.column) || !Number.isSafeInteger(delta.row)) {
    throw movementError('SYSTEM_WORKFLOW_MOVEMENT_GROUP_INVALID', 'Group movement requires placements and an integer cell delta');
  }
  const geometries = placements.map(placementGeometry);
  const minimumColumn = Math.min(...geometries.map(({ column }) => column));
  const minimumRow = Math.min(...geometries.map(({ row }) => row));
  const maximumColumn = Math.max(...geometries.map(({ column, columnSpan }) => column + columnSpan));
  const maximumRow = Math.max(...geometries.map(({ row, rowSpan }) => row + rowSpan));
  return {
    column: clamp(delta.column, -minimumColumn, SYSTEM_WORKFLOW_GEOMETRY.columns - maximumColumn),
    row: clamp(delta.row, -minimumRow, SYSTEM_WORKFLOW_GEOMETRY.rows - maximumRow),
  };
}

export function createSystemWorkflowGroupMovementRequest(placements, delta, gridId) {
  const bounded = clampSystemWorkflowGroupDelta(placements, delta);
  if (bounded.column === 0 && bounded.row === 0) return null;
  return {
    gridId,
    moves: placements.map((placement) => {
      const expectedStartGeometry = placementGeometry(placement);
      return {
        placementId: placement.id,
        expectedStartGeometry,
        destination: {
          ...expectedStartGeometry,
          column: expectedStartGeometry.column + bounded.column,
          row: expectedStartGeometry.row + bounded.row,
        },
      };
    }),
  };
}

export function createSystemWorkflowGroupMovementCandidate(draftInput, { moves, gridId } = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  const grid = draft.grids.find((candidate) => candidate.id === gridId);
  if (!grid) throw movementError('SYSTEM_WORKFLOW_MOVEMENT_GRID_UNKNOWN', 'The active canonical grid does not exist');
  if (grid.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw movementError('SYSTEM_WORKFLOW_MOVEMENT_GRID_PRIVATE', 'Placement movement is unavailable on a private grid');
  }
  if (!Array.isArray(moves) || moves.length < 1) {
    throw movementError('SYSTEM_WORKFLOW_MOVEMENT_GROUP_INVALID', 'Group movement requires at least one placement');
  }
  const ids = new Set();
  let delta = null;
  for (const move of moves) {
    if (!move?.placementId || ids.has(move.placementId)) {
      throw movementError('SYSTEM_WORKFLOW_MOVEMENT_GROUP_DUPLICATE', 'Group movement placement IDs must be unique');
    }
    ids.add(move.placementId);
    const placement = grid.placements.find((candidate) => candidate.id === move.placementId);
    if (!placement) throw movementError('SYSTEM_WORKFLOW_MOVEMENT_PLACEMENT_UNKNOWN', 'The canonical placement does not exist');
    if (placement.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
      throw movementError('SYSTEM_WORKFLOW_MOVEMENT_PLACEMENT_PRIVATE', 'Private placements cannot be moved through the public owner projection');
    }
    if (placement.locked) throw movementError('SYSTEM_WORKFLOW_MOVEMENT_PLACEMENT_LOCKED', 'The canonical placement is locked');
    const latest = placementGeometry(placement);
    if (!sameSystemWorkflowPlacementGeometry(latest, move.expectedStartGeometry)) {
      throw movementError('SYSTEM_WORKFLOW_MOVEMENT_START_STALE', 'The canonical placement changed before movement completed');
    }
    const destination = placementGeometry(move.destination);
    if (destination.columnSpan !== latest.columnSpan || destination.rowSpan !== latest.rowSpan) {
      throw movementError('SYSTEM_WORKFLOW_MOVEMENT_SPAN_CHANGED', 'Placement movement cannot resize the canonical placement');
    }
    const nextDelta = { column: destination.column - latest.column, row: destination.row - latest.row };
    if (!delta) delta = nextDelta;
    else if (delta.column !== nextDelta.column || delta.row !== nextDelta.row) {
      throw movementError('SYSTEM_WORKFLOW_MOVEMENT_GROUP_DELTA_MISMATCH', 'Every grouped placement must move by the same cell delta');
    }
  }
  if (!delta?.column && !delta?.row) return null;
  for (const move of moves) {
    const placement = grid.placements.find((candidate) => candidate.id === move.placementId);
    Object.assign(placement, placementGeometry(move.destination));
  }
  return assertValidSystemWorkflowDraft(draft);
}

export function createSystemWorkflowMovementCandidate(draftInput, {
  destination,
  expectedStartGeometry,
  placementId,
  gridId,
} = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  const grid = draft.grids.find((candidate) => candidate.id === gridId);
  if (!grid) throw movementError('SYSTEM_WORKFLOW_MOVEMENT_GRID_UNKNOWN', 'The active canonical grid does not exist');
  if (grid.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw movementError('SYSTEM_WORKFLOW_MOVEMENT_GRID_PRIVATE', 'Placement movement is unavailable on a private grid');
  }
  const placement = grid.placements.find((candidate) => candidate.id === placementId);
  if (!placement) throw movementError('SYSTEM_WORKFLOW_MOVEMENT_PLACEMENT_UNKNOWN', 'The canonical placement does not exist');
  if (placement.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw movementError('SYSTEM_WORKFLOW_MOVEMENT_PLACEMENT_PRIVATE', 'Private placements cannot be moved through the public owner projection');
  }
  if (placement.locked) throw movementError('SYSTEM_WORKFLOW_MOVEMENT_PLACEMENT_LOCKED', 'The canonical placement is locked');
  const latestGeometry = placementGeometry(placement);
  if (!sameSystemWorkflowPlacementGeometry(latestGeometry, expectedStartGeometry)) {
    throw movementError('SYSTEM_WORKFLOW_MOVEMENT_START_STALE', 'The canonical placement changed before movement completed');
  }
  const nextGeometry = placementGeometry(destination);
  if (nextGeometry.columnSpan !== latestGeometry.columnSpan || nextGeometry.rowSpan !== latestGeometry.rowSpan) {
    throw movementError('SYSTEM_WORKFLOW_MOVEMENT_SPAN_CHANGED', 'Placement movement cannot resize the canonical placement');
  }
  if (sameSystemWorkflowPlacementGeometry(latestGeometry, nextGeometry)) return null;
  Object.assign(placement, nextGeometry);
  return assertValidSystemWorkflowDraft(draft);
}
