export const reorderSelectedPlacements = (placements, selectedIds, direction) => {
  const selected = new Set(selectedIds);
  let reordered = [...placements];
  if (direction <= -placements.length) {
    reordered = [...reordered.filter(({ id }) => selected.has(id)), ...reordered.filter(({ id }) => !selected.has(id))];
  } else if (direction >= placements.length) {
    reordered = [...reordered.filter(({ id }) => !selected.has(id)), ...reordered.filter(({ id }) => selected.has(id))];
  } else if (direction < 0) {
    for (let index = 1; index < reordered.length; index += 1) {
      if (selected.has(reordered[index].id) && !selected.has(reordered[index - 1].id)) {
        [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
      }
    }
  } else if (direction > 0) {
    for (let index = reordered.length - 2; index >= 0; index -= 1) {
      if (selected.has(reordered[index].id) && !selected.has(reordered[index + 1].id)) {
        [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
      }
    }
  }
  return reordered;
};

export const duplicateSelectedPlacements = (placements, stamp, offset = 40) => placements.map((placement, index) => ({
  ...placement,
  id: `placement-${stamp}-${index}`,
  locked: false,
  left: placement.left + offset,
  top: placement.top + offset,
}));

export const togglePlacementLock = (placements, placementId) => placements.map((placement) => (
  placement.id === placementId ? { ...placement, locked: !placement.locked } : placement
));

export const selectionAfterPlacementRemoval = ({ activePlacements, placementId, selectedPlacementId, selectedPlacementIds }) => {
  const index = activePlacements.findIndex(({ id }) => id === placementId);
  const remaining = activePlacements.filter(({ id }) => id !== placementId);
  const retained = selectedPlacementIds.filter((id) => id !== placementId);
  const fallbackId = remaining[Math.min(index, remaining.length - 1)]?.id || null;
  const ids = retained.length ? retained : fallbackId ? [fallbackId] : [];
  const primaryId = retained.includes(selectedPlacementId) ? selectedPlacementId : retained.at(-1) || fallbackId;
  return { ids, primaryId };
};

export const projectSelectionLayers = ({ activePlacements, assets, removeCandidateId, selectedPlacementIds }) => [...activePlacements]
  .reverse()
  .map((placement) => {
    const asset = assets.find(({ stableAssetId }) => stableAssetId === placement.assetId);
    return {
      confirming: removeCandidateId === placement.id,
      id: placement.id,
      locked: Boolean(placement.locked),
      previewSrc: asset?.previewSrc,
      selected: selectedPlacementIds.includes(placement.id),
      title: asset?.title,
    };
  });
