import { useEffect, useState } from 'react';
import {
  duplicateSelectedPlacements,
  projectSelectionLayers,
  reorderSelectedPlacements,
  selectionAfterPlacementRemoval,
  togglePlacementLock,
} from './ownerShellSystemSelectionCommands.js';

export default function useOwnerShellSystemSelectionCommands({
  activePlacements,
  activeTableId,
  assets,
  onNotice,
  replaceSelection,
  selectedPlacementId,
  selectedPlacementIds,
  selectedPlacements,
  selectPlacement,
  setPlacements,
}) {
  const [removeCandidateId, setRemoveCandidateId] = useState(null);
  const layers = projectSelectionLayers({ activePlacements, assets, removeCandidateId, selectedPlacementIds });
  const cancelRemove = () => setRemoveCandidateId(null);
  const requestRemove = (placementId) => setRemoveCandidateId(placementId);
  const selectLayer = (placementId, additive) => {
    if (activePlacements.find(({ id }) => id === placementId)?.locked) return;
    selectPlacement(placementId, additive);
    cancelRemove();
  };
  const moveSelectedLayer = (direction) => {
    if (!selectedPlacements.length) return;
    const reordered = reorderSelectedPlacements(activePlacements, selectedPlacementIds, direction);
    setPlacements((current) => {
      const queue = [...reordered];
      return current.map((placement) => placement.tableId === activeTableId ? queue.shift() : placement);
    });
  };
  const duplicateSelected = () => {
    if (!selectedPlacements.length) return;
    const duplicates = duplicateSelectedPlacements(selectedPlacements, Date.now());
    setPlacements((current) => [...current, ...duplicates]);
    replaceSelection(duplicates.map(({ id }) => id), duplicates.at(-1).id);
  };
  const removePlacement = (placementId) => {
    const nextSelection = selectionAfterPlacementRemoval({
      activePlacements,
      placementId,
      selectedPlacementId,
      selectedPlacementIds,
    });
    setPlacements((current) => current.filter(({ id }) => id !== placementId));
    replaceSelection(nextSelection.ids, nextSelection.primaryId);
    cancelRemove();
    onNotice('PLACEMENT REMOVED FROM THIS TABLE / ASSET RETAINED');
  };
  const rotate = () => onNotice('ROTATE CONTROL PLACED HERE / NOT CONNECTED');
  const mirrorHorizontal = () => onNotice('MIRROR H CONTROL PLACED HERE / NOT CONNECTED');
  const mirrorVertical = () => onNotice('MIRROR V CONTROL PLACED HERE / NOT CONNECTED');
  const toggleLock = (placementId) => {
    setPlacements((current) => togglePlacementLock(current, placementId));
    cancelRemove();
  };

  useEffect(() => {
    if (!removeCandidateId) return undefined;
    const cancelRemoveOnEscape = (event) => {
      if (event.key === 'Escape') cancelRemove();
    };
    globalThis.addEventListener('keydown', cancelRemoveOnEscape, true);
    return () => globalThis.removeEventListener('keydown', cancelRemoveOnEscape, true);
  }, [removeCandidateId]);

  return {
    cancelRemove,
    duplicateSelected,
    layers,
    mirrorHorizontal,
    mirrorVertical,
    moveSelectedLayer,
    removePlacement,
    requestRemove,
    rotate,
    selectLayer,
    toggleLock,
  };
}
