import { SYSTEM_WORKFLOW_VISIBILITY, assertValidSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { orderedLatticeProductionLayers as orderedSystemWorkflowLayers } from '../lattice/rendering/latticeProductionLayerOrder.js';
import { sameSystemWorkflowPlacementSnapshot } from './systemWorkflowRemoval.js';

export const SYSTEM_WORKFLOW_LAYER_OPERATIONS = Object.freeze({
  FORWARD: 'FORWARD',
  BACKWARD: 'BACKWARD',
  FRONT: 'FRONT',
  BACK: 'BACK',
});

const OPERATIONS = new Set(Object.values(SYSTEM_WORKFLOW_LAYER_OPERATIONS));
function layerError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

export function systemWorkflowLayerTopologySnapshot(grid) {
  return [...(Array.isArray(grid?.placements) ? grid.placements : [])]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((placement) => structuredClone(placement));
}

export function sameSystemWorkflowLayerTopology(grid, expectedPlacements) {
  if (!Array.isArray(expectedPlacements) || grid?.placements?.length !== expectedPlacements.length) return false;
  const expectedById = new Map(expectedPlacements.map((placement) => [placement?.id, placement]));
  return expectedById.size === expectedPlacements.length
    && grid.placements.every((placement) => sameSystemWorkflowPlacementSnapshot(
      placement,
      expectedById.get(placement.id),
    ));
}

function rotateForward(visible, selectedIndex, destinationIndex) {
  const layers = visible.map(({ layer }) => layer);
  visible[selectedIndex].layer = layers[destinationIndex];
  for (let index = selectedIndex + 1; index <= destinationIndex; index += 1) {
    visible[index].layer = layers[index - 1];
  }
}

function rotateBackward(visible, selectedIndex, destinationIndex) {
  const layers = visible.map(({ layer }) => layer);
  visible[selectedIndex].layer = layers[destinationIndex];
  for (let index = destinationIndex; index < selectedIndex; index += 1) {
    visible[index].layer = layers[index + 1];
  }
}

export function systemWorkflowLayerOperationAvailability(grid, placementId) {
  const visible = orderedSystemWorkflowLayers(
    (Array.isArray(grid?.placements) ? grid.placements : [])
      .filter((placement) => placement.visibility === SYSTEM_WORKFLOW_VISIBILITY.PUBLIC),
  );
  const selectedIndex = visible.findIndex((placement) => placement.id === placementId);
  const unavailable = Object.freeze({ BACK: false, BACKWARD: false, FORWARD: false, FRONT: false });
  if (selectedIndex < 0 || visible[selectedIndex].locked) return unavailable;
  const behind = visible.slice(0, selectedIndex);
  const ahead = visible.slice(selectedIndex + 1);
  return Object.freeze({
    BACK: behind.length > 0 && behind.every((placement) => !placement.locked),
    BACKWARD: Boolean(behind.at(-1) && !behind.at(-1).locked),
    FORWARD: Boolean(ahead[0] && !ahead[0].locked),
    FRONT: ahead.length > 0 && ahead.every((placement) => !placement.locked),
  });
}

export function createSystemWorkflowLayerCandidate(draftInput, {
  expectedPlacement,
  expectedPlacements,
  operation,
  placementId,
  gridId,
} = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  if (!OPERATIONS.has(operation)) {
    throw layerError('SYSTEM_WORKFLOW_LAYER_OPERATION_INVALID', 'Layer editing requires a canonical operation');
  }
  const grid = draft.grids.find((candidate) => candidate.id === gridId);
  if (!grid) throw layerError('SYSTEM_WORKFLOW_LAYER_GRID_UNKNOWN', 'The active canonical grid does not exist');
  if (grid.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw layerError('SYSTEM_WORKFLOW_LAYER_GRID_PRIVATE', 'Layer editing is unavailable on a private grid');
  }
  const placement = grid.placements.find((candidate) => candidate.id === placementId);
  if (!placement) throw layerError('SYSTEM_WORKFLOW_LAYER_PLACEMENT_UNKNOWN', 'The canonical placement does not exist');
  if (!sameSystemWorkflowPlacementSnapshot(placement, expectedPlacement)) {
    throw layerError('SYSTEM_WORKFLOW_LAYER_PLACEMENT_STALE', 'The canonical placement changed before layer editing completed');
  }
  if (!sameSystemWorkflowLayerTopology(grid, expectedPlacements)) {
    throw layerError('SYSTEM_WORKFLOW_LAYER_TOPOLOGY_STALE', 'The canonical layer topology changed before layer editing completed');
  }
  if (placement.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw layerError('SYSTEM_WORKFLOW_LAYER_PLACEMENT_PRIVATE', 'Private placements cannot be layered through the public owner projection');
  }
  if (placement.locked) throw layerError('SYSTEM_WORKFLOW_LAYER_PLACEMENT_LOCKED', 'The canonical placement is locked');

  const visible = orderedSystemWorkflowLayers(
    grid.placements.filter((candidate) => candidate.visibility === SYSTEM_WORKFLOW_VISIBILITY.PUBLIC),
  );
  const selectedIndex = visible.findIndex((candidate) => candidate.id === placementId);
  const availability = systemWorkflowLayerOperationAvailability(grid, placementId);
  if (!availability[operation]) return null;
  const movingForward = operation === SYSTEM_WORKFLOW_LAYER_OPERATIONS.FORWARD
    || operation === SYSTEM_WORKFLOW_LAYER_OPERATIONS.FRONT;
  const destinationIndex = operation === SYSTEM_WORKFLOW_LAYER_OPERATIONS.FRONT
    ? visible.length - 1
    : operation === SYSTEM_WORKFLOW_LAYER_OPERATIONS.BACK
      ? 0
      : selectedIndex + (movingForward ? 1 : -1);
  if (movingForward) rotateForward(visible, selectedIndex, destinationIndex);
  else rotateBackward(visible, selectedIndex, destinationIndex);
  return assertValidSystemWorkflowDraft(draft);
}

export function createSystemWorkflowLayerReorderCandidate(draftInput, {
  expectedPlacements,
  orderedPlacementIds,
  gridId,
} = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  const grid = draft.grids.find((candidate) => candidate.id === gridId);
  if (!grid) throw layerError('SYSTEM_WORKFLOW_LAYER_GRID_UNKNOWN', 'The active canonical grid does not exist');
  if (grid.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw layerError('SYSTEM_WORKFLOW_LAYER_GRID_PRIVATE', 'Layer editing is unavailable on a private grid');
  }
  if (!sameSystemWorkflowLayerTopology(grid, expectedPlacements)) {
    throw layerError('SYSTEM_WORKFLOW_LAYER_TOPOLOGY_STALE', 'The canonical layer topology changed before layer editing completed');
  }
  const visible = grid.placements.filter(({ visibility }) => visibility === SYSTEM_WORKFLOW_VISIBILITY.PUBLIC);
  if (!Array.isArray(orderedPlacementIds) || orderedPlacementIds.length !== visible.length
    || new Set(orderedPlacementIds).size !== visible.length
    || orderedPlacementIds.some((id) => !visible.some((placement) => placement.id === id))) {
    throw layerError('SYSTEM_WORKFLOW_LAYER_ORDER_INVALID', 'Layer order must contain every public placement exactly once');
  }
  const current = orderedSystemWorkflowLayers(visible);
  if (current.some((placement) => placement.locked)) {
    throw layerError('SYSTEM_WORKFLOW_LAYER_PLACEMENT_LOCKED', 'Locked placements prevent arbitrary layer reordering');
  }
  if (current.every((placement, index) => placement.id === orderedPlacementIds[index])) return null;
  const layers = current.map(({ layer }) => layer);
  const byId = new Map(visible.map((placement) => [placement.id, placement]));
  orderedPlacementIds.forEach((id, index) => { byId.get(id).layer = layers[index]; });
  return assertValidSystemWorkflowDraft(draft);
}
