import {
  LATTICE_PRODUCTION_VISIBILITY,
  assertValidLatticeProductionDraft,
} from '../domain/latticeProductionDraft.js';

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
    visibility: placement.visibility,
    locked: placement.locked,
  };
}

export function sameLatticeProductionPlacementSnapshot(left, right) {
  return JSON.stringify(canonicalPlacementSnapshot(left))
    === JSON.stringify(canonicalPlacementSnapshot(right));
}

export function createLatticeProductionRemovalCandidate(draftInput, {
  expectedPlacement,
  placementId,
  tableId,
} = {}) {
  const draft = assertValidLatticeProductionDraft(draftInput);
  const table = draft.tables.find((candidate) => candidate.id === tableId);
  if (!table) throw removalError('LATTICE_REMOVAL_TABLE_UNKNOWN', 'The active canonical table does not exist');
  if (table.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
    throw removalError('LATTICE_REMOVAL_TABLE_PRIVATE', 'Placement removal is unavailable on a private table');
  }
  const placementIndex = table.placements.findIndex((candidate) => candidate.id === placementId);
  if (placementIndex < 0) {
    throw removalError('LATTICE_REMOVAL_PLACEMENT_UNKNOWN', 'The canonical placement does not exist');
  }
  const placement = table.placements[placementIndex];
  if (!sameLatticeProductionPlacementSnapshot(placement, expectedPlacement)) {
    throw removalError('LATTICE_REMOVAL_PLACEMENT_STALE', 'The canonical placement changed before removal completed');
  }
  if (placement.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
    throw removalError('LATTICE_REMOVAL_PLACEMENT_PRIVATE', 'Private placements cannot be removed through the public owner projection');
  }
  if (placement.locked) {
    throw removalError('LATTICE_REMOVAL_PLACEMENT_LOCKED', 'The canonical placement is locked');
  }
  table.placements.splice(placementIndex, 1);
  return assertValidLatticeProductionDraft(draft);
}
