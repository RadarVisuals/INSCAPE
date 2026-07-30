const placementId = (placement) => typeof placement?.id === 'string' ? placement.id : '';

export function compareLatticeProductionLayers(left, right) {
  return left.layer - right.layer || placementId(left).localeCompare(placementId(right));
}

export function orderedLatticeProductionLayers(placements) {
  return [...(Array.isArray(placements) ? placements : [])].sort(compareLatticeProductionLayers);
}

export function createLatticeProductionLayerRanks(placements) {
  return new Map(orderedLatticeProductionLayers(placements)
    .map((placement, rank) => [placement.id, rank]));
}
