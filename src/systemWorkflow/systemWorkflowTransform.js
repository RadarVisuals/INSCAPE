import { assertValidSystemWorkflowDraft, SYSTEM_WORKFLOW_VISIBILITY } from './domain/systemWorkflowDraft.js';
import { sameSystemWorkflowPlacementSnapshot } from './systemWorkflowRemoval.js';

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
  for (const placement of placements) applyTransform(placement, operation);
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
