import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';

export const PLACEMENT_LAYER_DIRECTIONS = Object.freeze({
  BACKWARD: 'BACKWARD',
  FORWARD: 'FORWARD',
});

function requirePlacements(placements) {
  if (!Array.isArray(placements)) throw new TypeError('Placement lifecycle requires a placement array');
  return placements;
}

function requirePlacement(placements, placementId) {
  const placement = requirePlacements(placements).find(({ id }) => id === placementId);
  if (!placement) throw new TypeError('Placement lifecycle requires an existing placement ID');
  return placement;
}

function visualOrder(placements) {
  return [...placements].sort((first, second) => first.layer - second.layer
    || first.navigationOrder - second.navigationOrder
    || first.id.localeCompare(second.id));
}

export function placementLayerAvailability(placements, placementId) {
  const ordered = visualOrder(requirePlacements(placements));
  const index = ordered.findIndex(({ id }) => id === placementId);
  if (index < 0) throw new TypeError('Placement lifecycle requires an existing placement ID');
  return { backward: index > 0, forward: index < ordered.length - 1 };
}

export function movePlacementLayer(placements, placementId, direction) {
  requirePlacement(placements, placementId);
  if (!Object.values(PLACEMENT_LAYER_DIRECTIONS).includes(direction)) {
    throw new TypeError('Placement layer movement requires a canonical direction');
  }
  const ordered = visualOrder(placements);
  const index = ordered.findIndex(({ id }) => id === placementId);
  const targetIndex = direction === PLACEMENT_LAYER_DIRECTIONS.FORWARD ? index + 1 : index - 1;
  if (targetIndex < 0 || targetIndex >= ordered.length) return placements.map((placement) => ({ ...placement }));
  [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
  const layersById = new Map(ordered.map(({ id }, layer) => [id, layer]));
  return placements.map((placement) => ({ ...placement, layer: layersById.get(placement.id) }));
}

export function removePlacement(placements, placementId) {
  requirePlacement(placements, placementId);
  return placements.filter(({ id }) => id !== placementId).map((placement) => ({ ...placement }));
}

export function replacePlacementAsset(placements, placementId, stableAssetId) {
  requirePlacement(placements, placementId);
  if (!parseCanonicalAssetId(stableAssetId)) {
    throw new TypeError('Placement replacement requires a canonical stable asset ID');
  }
  return placements.map((placement) => placement.id === placementId
    ? { ...placement, stableAssetId, crop: null }
    : { ...placement });
}
