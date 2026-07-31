import { LATTICE_PRODUCTION_VISIBILITY, assertValidLatticeProductionDraft } from '../domain/latticeProductionDraft.js';
import { orderedLatticeProductionLayers } from '../rendering/latticeProductionLayerOrder.js';
import { sameLatticeProductionPlacementSnapshot } from './latticeProductionRemoval.js';

export const LATTICE_PRODUCTION_LAYER_OPERATIONS = Object.freeze({
  FORWARD: 'FORWARD',
  BACKWARD: 'BACKWARD',
  FRONT: 'FRONT',
  BACK: 'BACK',
});

const OPERATIONS = new Set(Object.values(LATTICE_PRODUCTION_LAYER_OPERATIONS));
function layerError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

export function latticeProductionLayerTopologySnapshot(table) {
  return [...(Array.isArray(table?.placements) ? table.placements : [])]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((placement) => structuredClone(placement));
}

export function sameLatticeProductionLayerTopology(table, expectedPlacements) {
  if (!Array.isArray(expectedPlacements) || table?.placements?.length !== expectedPlacements.length) return false;
  const expectedById = new Map(expectedPlacements.map((placement) => [placement?.id, placement]));
  return expectedById.size === expectedPlacements.length
    && table.placements.every((placement) => sameLatticeProductionPlacementSnapshot(
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

export function latticeProductionLayerOperationAvailability(table, placementId) {
  const visible = orderedLatticeProductionLayers(
    (Array.isArray(table?.placements) ? table.placements : [])
      .filter((placement) => placement.visibility === LATTICE_PRODUCTION_VISIBILITY.PUBLIC),
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

export function createLatticeProductionLayerCandidate(draftInput, {
  expectedPlacement,
  expectedPlacements,
  operation,
  placementId,
  tableId,
} = {}) {
  const draft = assertValidLatticeProductionDraft(draftInput);
  if (!OPERATIONS.has(operation)) {
    throw layerError('LATTICE_LAYER_OPERATION_INVALID', 'Layer editing requires a canonical operation');
  }
  const table = draft.tables.find((candidate) => candidate.id === tableId);
  if (!table) throw layerError('LATTICE_LAYER_TABLE_UNKNOWN', 'The active canonical table does not exist');
  if (table.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
    throw layerError('LATTICE_LAYER_TABLE_PRIVATE', 'Layer editing is unavailable on a private table');
  }
  const placement = table.placements.find((candidate) => candidate.id === placementId);
  if (!placement) throw layerError('LATTICE_LAYER_PLACEMENT_UNKNOWN', 'The canonical placement does not exist');
  if (!sameLatticeProductionPlacementSnapshot(placement, expectedPlacement)) {
    throw layerError('LATTICE_LAYER_PLACEMENT_STALE', 'The canonical placement changed before layer editing completed');
  }
  if (!sameLatticeProductionLayerTopology(table, expectedPlacements)) {
    throw layerError('LATTICE_LAYER_TOPOLOGY_STALE', 'The canonical layer topology changed before layer editing completed');
  }
  if (placement.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
    throw layerError('LATTICE_LAYER_PLACEMENT_PRIVATE', 'Private placements cannot be layered through the public owner projection');
  }
  if (placement.locked) throw layerError('LATTICE_LAYER_PLACEMENT_LOCKED', 'The canonical placement is locked');

  const visible = orderedLatticeProductionLayers(
    table.placements.filter((candidate) => candidate.visibility === LATTICE_PRODUCTION_VISIBILITY.PUBLIC),
  );
  const selectedIndex = visible.findIndex((candidate) => candidate.id === placementId);
  const availability = latticeProductionLayerOperationAvailability(table, placementId);
  if (!availability[operation]) return null;
  const movingForward = operation === LATTICE_PRODUCTION_LAYER_OPERATIONS.FORWARD
    || operation === LATTICE_PRODUCTION_LAYER_OPERATIONS.FRONT;
  const destinationIndex = operation === LATTICE_PRODUCTION_LAYER_OPERATIONS.FRONT
    ? visible.length - 1
    : operation === LATTICE_PRODUCTION_LAYER_OPERATIONS.BACK
      ? 0
      : selectedIndex + (movingForward ? 1 : -1);
  if (movingForward) rotateForward(visible, selectedIndex, destinationIndex);
  else rotateBackward(visible, selectedIndex, destinationIndex);
  return assertValidLatticeProductionDraft(draft);
}

export function createLatticeProductionLayerReorderCandidate(draftInput, {
  expectedPlacements,
  orderedPlacementIds,
  tableId,
} = {}) {
  const draft = assertValidLatticeProductionDraft(draftInput);
  const table = draft.tables.find((candidate) => candidate.id === tableId);
  if (!table) throw layerError('LATTICE_LAYER_TABLE_UNKNOWN', 'The active canonical table does not exist');
  if (table.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
    throw layerError('LATTICE_LAYER_TABLE_PRIVATE', 'Layer editing is unavailable on a private table');
  }
  if (!sameLatticeProductionLayerTopology(table, expectedPlacements)) {
    throw layerError('LATTICE_LAYER_TOPOLOGY_STALE', 'The canonical layer topology changed before layer editing completed');
  }
  const visible = table.placements.filter(({ visibility }) => visibility === LATTICE_PRODUCTION_VISIBILITY.PUBLIC);
  if (!Array.isArray(orderedPlacementIds) || orderedPlacementIds.length !== visible.length
    || new Set(orderedPlacementIds).size !== visible.length
    || orderedPlacementIds.some((id) => !visible.some((placement) => placement.id === id))) {
    throw layerError('LATTICE_LAYER_ORDER_INVALID', 'Layer order must contain every public placement exactly once');
  }
  const current = orderedLatticeProductionLayers(visible);
  if (current.some((placement) => placement.locked)) {
    throw layerError('LATTICE_LAYER_PLACEMENT_LOCKED', 'Locked placements prevent arbitrary layer reordering');
  }
  if (current.every((placement, index) => placement.id === orderedPlacementIds[index])) return null;
  const layers = current.map(({ layer }) => layer);
  const byId = new Map(visible.map((placement) => [placement.id, placement]));
  orderedPlacementIds.forEach((id, index) => { byId.get(id).layer = layers[index]; });
  return assertValidLatticeProductionDraft(draft);
}
