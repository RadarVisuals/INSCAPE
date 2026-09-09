import {
  SYSTEM_WORKFLOW_VISIBILITY,
  assertValidSystemWorkflowDraft,
} from './domain/systemWorkflowDraft.js';

function removalError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

function canonicalPlacementSnapshot(placement) {
  if (!placement || typeof placement !== 'object') return null;
  return {
    id: placement.id,
    stableAssetId: placement.stableAssetId,
    column: placement.column,
    row: placement.row,
    columnSpan: placement.columnSpan,
    rowSpan: placement.rowSpan,
    layer: placement.layer,
    navigationOrder: placement.navigationOrder,
    crop: placement.crop === null ? null : { ...placement.crop },
    frameId: placement.frameId,
    mat: placement.mat ? {
      enabled: placement.mat.enabled,
      color: placement.mat.color,
      inset: { ...placement.mat.inset },
    } : null,
    backing: placement.backing ? { ...placement.backing } : null,
    transparencyMode: placement.transparencyMode,
    transform: placement.transform ? { ...placement.transform } : null,
    visibility: placement.visibility,
    locked: placement.locked,
  };
}

export function createSystemWorkflowGroupRemovalCandidate(draftInput, {
  expectedPlacements,
  placementIds,
  gridId,
} = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  const grid = draft.grids.find((candidate) => candidate.id === gridId);
  if (!grid) throw removalError('SYSTEM_WORKFLOW_REMOVAL_GRID_UNKNOWN', 'The active canonical grid does not exist');
  if (grid.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw removalError('SYSTEM_WORKFLOW_REMOVAL_GRID_PRIVATE', 'Placement removal is unavailable on a private grid');
  }
  if (!Array.isArray(placementIds) || placementIds.length < 1
    || new Set(placementIds).size !== placementIds.length
    || !Array.isArray(expectedPlacements) || expectedPlacements.length !== placementIds.length) {
    throw removalError('SYSTEM_WORKFLOW_REMOVAL_GROUP_INVALID', 'Group removal requires unique placement snapshots');
  }
  const expectedById = new Map(expectedPlacements.map((placement) => [placement?.id, placement]));
  const removalIds = new Set(placementIds);
  for (const placementId of placementIds) {
    const placement = grid.placements.find((candidate) => candidate.id === placementId);
    if (!placement) throw removalError('SYSTEM_WORKFLOW_REMOVAL_PLACEMENT_UNKNOWN', 'The canonical placement does not exist');
    if (!sameSystemWorkflowPlacementSnapshot(placement, expectedById.get(placementId))) {
      throw removalError('SYSTEM_WORKFLOW_REMOVAL_PLACEMENT_STALE', 'The canonical placement changed before removal completed');
    }
    if (placement.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
      throw removalError('SYSTEM_WORKFLOW_REMOVAL_PLACEMENT_PRIVATE', 'Private placements cannot be removed through the public owner projection');
    }
    if (placement.locked) throw removalError('SYSTEM_WORKFLOW_REMOVAL_PLACEMENT_LOCKED', 'The canonical placement is locked');
  }
  grid.placements = grid.placements.filter(({ id }) => !removalIds.has(id));
  return assertValidSystemWorkflowDraft(draft);
}

export function sameSystemWorkflowPlacementSnapshot(left, right) {
  return JSON.stringify(canonicalPlacementSnapshot(left))
    === JSON.stringify(canonicalPlacementSnapshot(right));
}

export function createSystemWorkflowRemovalCandidate(draftInput, {
  expectedPlacement,
  placementId,
  gridId,
} = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  const grid = draft.grids.find((candidate) => candidate.id === gridId);
  if (!grid) throw removalError('SYSTEM_WORKFLOW_REMOVAL_GRID_UNKNOWN', 'The active canonical grid does not exist');
  if (grid.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw removalError('SYSTEM_WORKFLOW_REMOVAL_GRID_PRIVATE', 'Placement removal is unavailable on a private grid');
  }
  const placementIndex = grid.placements.findIndex((candidate) => candidate.id === placementId);
  if (placementIndex < 0) {
    throw removalError('SYSTEM_WORKFLOW_REMOVAL_PLACEMENT_UNKNOWN', 'The canonical placement does not exist');
  }
  const placement = grid.placements[placementIndex];
  if (!sameSystemWorkflowPlacementSnapshot(placement, expectedPlacement)) {
    throw removalError('SYSTEM_WORKFLOW_REMOVAL_PLACEMENT_STALE', 'The canonical placement changed before removal completed');
  }
  if (placement.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw removalError('SYSTEM_WORKFLOW_REMOVAL_PLACEMENT_PRIVATE', 'Private placements cannot be removed through the public owner projection');
  }
  if (placement.locked) {
    throw removalError('SYSTEM_WORKFLOW_REMOVAL_PLACEMENT_LOCKED', 'The canonical placement is locked');
  }
  grid.placements.splice(placementIndex, 1);
  return assertValidSystemWorkflowDraft(draft);
}
