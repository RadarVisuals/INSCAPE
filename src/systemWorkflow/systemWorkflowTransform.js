import {
  assertValidSystemWorkflowDraft,
  quantizeSystemWorkflowGridCoordinate,
  SYSTEM_WORKFLOW_VISIBILITY,
  SYSTEM_WORKFLOW_WORLD_BOUNDS,
} from './domain/systemWorkflowDraft.js';
import { sameSystemWorkflowPlacementSnapshot } from './systemWorkflowRemoval.js';
import { systemWorkflowGroupBounds } from './systemWorkflowResize.js';

export const SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS = Object.freeze({
  ROTATE: 'ROTATE',
  MIRROR_HORIZONTAL: 'MIRROR_HORIZONTAL',
  MIRROR_VERTICAL: 'MIRROR_VERTICAL',
});

const operations = new Set(Object.values(SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS));
function transformError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

function applyTransform(placement, operation) {
  if (operation === SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.ROTATE) {
    placement.transform.quarterTurns = (placement.transform.quarterTurns + 1) % 4;
  } else if (operation === SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.MIRROR_HORIZONTAL) {
    placement.transform.mirrorX = !placement.transform.mirrorX;
  } else {
    placement.transform.mirrorY = !placement.transform.mirrorY;
  }
}

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function transformSystemWorkflowGroupGeometries(placementsInput, operation) {
  const placements = Array.isArray(placementsInput) ? placementsInput : [];
  if (placements.length < 2 || !operations.has(operation)) {
    throw transformError('SYSTEM_WORKFLOW_TRANSFORM_GROUP_INVALID', 'Group geometry transform requires multiple placements and a canonical operation');
  }
  const bounds = systemWorkflowGroupBounds(placements);
  if (operation === SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.MIRROR_HORIZONTAL) {
    return placements.map((placement) => Object.freeze({
      placementId: placement.id,
      destination: Object.freeze({
        column: quantizeSystemWorkflowGridCoordinate(
          (2 * bounds.column) + bounds.columnSpan - placement.column - placement.columnSpan,
        ),
        row: placement.row,
        columnSpan: placement.columnSpan,
        rowSpan: placement.rowSpan,
      }),
    }));
  }
  if (operation === SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.MIRROR_VERTICAL) {
    return placements.map((placement) => Object.freeze({
      placementId: placement.id,
      destination: Object.freeze({
        column: placement.column,
        row: quantizeSystemWorkflowGridCoordinate(
          (2 * bounds.row) + bounds.rowSpan - placement.row - placement.rowSpan,
        ),
        columnSpan: placement.columnSpan,
        rowSpan: placement.rowSpan,
      }),
    }));
  }

  const rotatedWidth = bounds.rowSpan;
  const rotatedHeight = bounds.columnSpan;
  const requestedColumn = quantizeSystemWorkflowGridCoordinate(
    bounds.column + ((bounds.columnSpan - rotatedWidth) / 2),
  );
  const requestedRow = quantizeSystemWorkflowGridCoordinate(
    bounds.row + ((bounds.rowSpan - rotatedHeight) / 2),
  );
  const column = clamp(
    requestedColumn,
    SYSTEM_WORKFLOW_WORLD_BOUNDS.minimumColumn,
    SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumColumn - rotatedWidth,
  );
  const row = clamp(
    requestedRow,
    SYSTEM_WORKFLOW_WORLD_BOUNDS.minimumRow,
    SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumRow - rotatedHeight,
  );
  return placements.map((placement) => Object.freeze({
    placementId: placement.id,
    destination: Object.freeze({
      column: quantizeSystemWorkflowGridCoordinate(column + placement.row - bounds.row),
      row: quantizeSystemWorkflowGridCoordinate(
        row + bounds.columnSpan - (placement.column - bounds.column) - placement.columnSpan,
      ),
      columnSpan: placement.rowSpan,
      rowSpan: placement.columnSpan,
    }),
  }));
}

export function createSystemWorkflowTransformCandidate(draftInput, {
  expectedPlacement,
  operation,
  placementId,
  gridId,
} = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  const grid = draft.grids.find((candidate) => candidate.id === gridId);
  if (!grid) throw transformError('SYSTEM_WORKFLOW_TRANSFORM_GRID_UNKNOWN', 'The active canonical grid does not exist');
  if (grid.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) throw transformError('SYSTEM_WORKFLOW_TRANSFORM_GRID_PRIVATE', 'Placement transform is unavailable on a private grid');
  const placement = grid.placements.find((candidate) => candidate.id === placementId);
  if (!placement || placement.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) throw transformError('SYSTEM_WORKFLOW_TRANSFORM_PLACEMENT_UNAVAILABLE', 'Canonical public placement is unavailable');
  if (placement.locked) throw transformError('SYSTEM_WORKFLOW_TRANSFORM_PLACEMENT_LOCKED', 'Placement is locked');
  if (!operations.has(operation)) throw transformError('SYSTEM_WORKFLOW_TRANSFORM_OPERATION_INVALID', 'Unknown placement transform operation');
  if (!sameSystemWorkflowPlacementSnapshot(placement, expectedPlacement)) throw transformError('SYSTEM_WORKFLOW_TRANSFORM_STALE_PLACEMENT', 'Canonical placement changed before transform');

  applyTransform(placement, operation);
  return assertValidSystemWorkflowDraft(draft);
}

export function createSystemWorkflowGroupTransformCandidate(draftInput, {
  expectedPlacements,
  operation,
  placementIds,
  gridId,
} = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  if (!operations.has(operation)) throw transformError('SYSTEM_WORKFLOW_TRANSFORM_OPERATION_INVALID', 'Unknown group transform operation');
  const grid = draft.grids.find((candidate) => candidate.id === gridId);
  if (!grid) throw transformError('SYSTEM_WORKFLOW_TRANSFORM_GRID_UNKNOWN', 'The active canonical grid does not exist');
  if (grid.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) throw transformError('SYSTEM_WORKFLOW_TRANSFORM_GRID_PRIVATE', 'Group transform is unavailable on a private grid');
  const ids = Array.isArray(placementIds) ? placementIds : [];
  if (ids.length < 2 || new Set(ids).size !== ids.length
    || !Array.isArray(expectedPlacements) || expectedPlacements.length !== ids.length) {
    throw transformError('SYSTEM_WORKFLOW_TRANSFORM_GROUP_INVALID', 'Group transform requires matching unique placement snapshots');
  }
  const placements = ids.map((id, index) => {
    const placement = grid.placements.find((candidate) => candidate.id === id);
    if (!placement || placement.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
      throw transformError('SYSTEM_WORKFLOW_TRANSFORM_PLACEMENT_UNAVAILABLE', 'A canonical public group placement is unavailable');
    }
    if (placement.locked) throw transformError('SYSTEM_WORKFLOW_TRANSFORM_PLACEMENT_LOCKED', 'A group placement is locked');
    if (!sameSystemWorkflowPlacementSnapshot(placement, expectedPlacements[index])) {
      throw transformError('SYSTEM_WORKFLOW_TRANSFORM_STALE_PLACEMENT', 'A canonical group placement changed before transform');
    }
    return placement;
  });
  const destinations = transformSystemWorkflowGroupGeometries(placements, operation);
  for (const placement of placements) {
    Object.assign(placement, destinations.find(({ placementId }) => placementId === placement.id).destination);
    applyTransform(placement, operation);
  }
  return assertValidSystemWorkflowDraft(draft);
}

export function projectSystemWorkflowTransform(transform, dimensions, crop = null) {
  const quarterTurns = transform?.quarterTurns || 0;
  const mirrorX = transform?.mirrorX === true;
  const mirrorY = transform?.mirrorY === true;
  const swapped = quarterTurns % 2 === 1;
  let x = crop?.x ?? 0.5;
  let y = crop?.y ?? 0.5;
  if (quarterTurns === 1) [x, y] = [1 - y, x];
  else if (quarterTurns === 2) [x, y] = [1 - x, 1 - y];
  else if (quarterTurns === 3) [x, y] = [y, 1 - x];
  if (mirrorX) x = 1 - x;
  if (mirrorY) y = 1 - y;
  return Object.freeze({
    crop: crop ? Object.freeze({ ...crop, x, y }) : null,
    dimensions: Object.freeze({
      width: swapped ? dimensions.height : dimensions.width,
      height: swapped ? dimensions.width : dimensions.height,
    }),
    css: `scale(${mirrorX ? -1 : 1}, ${mirrorY ? -1 : 1}) rotate(${quarterTurns * 90}deg)`,
    swapped,
  });
}

export function projectSystemWorkflowImageRenderRectangle(imageRectangle, transformProjection) {
  if (!imageRectangle) return null;
  if (!transformProjection?.swapped) return Object.freeze({ ...imageRectangle });
  return Object.freeze({
    left: imageRectangle.left + ((imageRectangle.width - imageRectangle.height) / 2),
    top: imageRectangle.top + ((imageRectangle.height - imageRectangle.width) / 2),
    width: imageRectangle.height,
    height: imageRectangle.width,
  });
}

export function unprojectSystemWorkflowCrop(transform, crop) {
  if (!crop) return null;
  const quarterTurns = transform?.quarterTurns || 0;
  const mirrorX = transform?.mirrorX === true;
  const mirrorY = transform?.mirrorY === true;
  let x = mirrorX ? 1 - crop.x : crop.x;
  let y = mirrorY ? 1 - crop.y : crop.y;
  if (quarterTurns === 1) [x, y] = [y, 1 - x];
  else if (quarterTurns === 2) [x, y] = [1 - x, 1 - y];
  else if (quarterTurns === 3) [x, y] = [1 - y, x];
  return Object.freeze({ ...crop, x, y });
}
