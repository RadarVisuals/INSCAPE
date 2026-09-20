import { useMemo, useRef } from 'react';
import { assetForPlacement } from '../../systemWorkflow/domain/placementMedia.js';
import { createOwnerSystemWorkflowFocusViewModel } from './ownerSystemWorkflowFocusViewModel.js';
import { clearOwnerSystemWorkflowDocumentSelection } from './ownerSystemWorkflowSelection.js';
import useDisplayInspection from './useDisplayInspection.js';

export default function useOwnerSystemWorkflowFocusViewer({ assetsById, controller, onOpen, resolveAssetDimensions }) {
  const placementRefs = useRef(new Map());
  const restoreSnapshotRef = useRef(null);
  const placements = useMemo(() => (controller.selectedGrid?.placements || []).filter(placement => placement.kind !== 'text'), [controller.selectedGrid?.placements]);
  // Inspection models are derived on demand, not during every Grid handoff.
  // The cache belongs to this placement/asset snapshot and is discarded when
  // either changes; it never owns authored placement or media state.
  const getEntry = useMemo(() => {
    const entries = new Map();
    return id => {
      if (!entries.has(id)) {
        const placement = placements.find(item => item.id === id);
        entries.set(id, placement ? createOwnerSystemWorkflowFocusViewModel(placement, assetsById.get(placement.stableAssetId)) : null);
      }
      return entries.get(id);
    };
  }, [placements, assetsById]);
  const viewer = useDisplayInspection({
    scope: controller.draft.profileAddress + ':' + controller.selectedGridId,
    items: placements,
    getElement: id => placementRefs.current.get(id),
    getEntry,
    prepare: async id => {
      const placement = placements.find(candidate => candidate.id === id);
      const asset = placement && assetForPlacement(assetsById.get(placement.stableAssetId), placement);
      const sourceUrl = asset?.src || asset?.originalImageUrl || asset?.imageUrl || asset?.thumbnailUrl;
      return Boolean(sourceUrl && (!resolveAssetDimensions || await resolveAssetDimensions(asset)));
    },
    onOpen: id => {
      restoreSnapshotRef.current = { gridId: controller.selectedGridId, placementIds: [...controller.selectedPlacementIds] };
      controller.replaceSelection([id]); onOpen?.();
    },
    onNavigate: id => controller.replaceSelection([id]),
    onBeginReturn: clearOwnerSystemWorkflowDocumentSelection,
    onClose: () => {
      clearOwnerSystemWorkflowDocumentSelection();
      const snapshot = restoreSnapshotRef.current; restoreSnapshotRef.current = null;
      if (snapshot?.gridId === controller.selectedGridId) controller.replaceSelection(snapshot.placementIds);
    },
  });
  return { ...viewer, registerPlacement: (id, node) => {
    if (node) placementRefs.current.set(id, node); else placementRefs.current.delete(id);
  } };
}
