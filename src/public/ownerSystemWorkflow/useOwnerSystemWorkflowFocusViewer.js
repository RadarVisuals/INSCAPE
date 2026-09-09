import { useEffect, useMemo, useRef, useState } from 'react';
import { createOwnerSystemWorkflowFocusViewModel } from './ownerSystemWorkflowFocusViewModel.js';
import { clearOwnerSystemWorkflowDocumentSelection } from './ownerSystemWorkflowSelection.js';

const rect = (node) => {
  const value = node?.getBoundingClientRect();
  return value ? { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height } : null;
};

export default function useOwnerSystemWorkflowFocusViewer({ assetsById, controller, onOpen, resolveAssetDimensions }) {
  const [placementId, setPlacementId] = useState(null);
  const [originRectangle, setOriginRectangle] = useState(null);
  const placementRefs = useRef(new Map());
  const placements = useMemo(() => (controller.selectedGrid?.placements || []).slice().sort((left, right) => left.navigationOrder - right.navigationOrder || left.id.localeCompare(right.id)), [controller.selectedGrid]);
  const position = placements.findIndex(({ id }) => id === placementId);
  const placement = position >= 0 ? placements[position] : null;
  const entry = placement ? createOwnerSystemWorkflowFocusViewModel(placement, assetsById.get(placement.stableAssetId)) : null;
  const registerPlacement = (id, node) => { if (node) placementRefs.current.set(id, node); else placementRefs.current.delete(id); };
  const close = () => {
    clearOwnerSystemWorkflowDocumentSelection();
    setPlacementId(null);
    setOriginRectangle(null);
  };
  const open = async (id) => {
    const source = placementRefs.current.get(id);
    const next = placements.find((candidate) => candidate.id === id);
    const asset = next && assetsById.get(next.stableAssetId);
    const sourceUrl = asset?.src || asset?.originalImageUrl || asset?.imageUrl || asset?.thumbnailUrl;
    const origin = rect(source);
    if (!source || !next || !sourceUrl || !origin) return false;
    if (resolveAssetDimensions && !await resolveAssetDimensions(asset)) return false;
    if (!source.isConnected) return false;
    setOriginRectangle(origin);
    controller.replaceSelection([id]);
    setPlacementId(id);
    onOpen?.();
    return true;
  };
  const navigate = (direction) => {
    if (position < 0 || placements.length < 2) return;
    const next = placements[(position + direction + placements.length) % placements.length];
    controller.replaceSelection([next.id]);
    setPlacementId(next.id);
  };
  useEffect(() => { if (placementId && position < 0) close(); }, [placementId, position]);
  return {
    close,
    entry,
    getReturnRectangle: () => rect(placementRefs.current.get(placementId)) || originRectangle,
    navigate,
    open,
    originRectangle,
    placementId,
    position,
    registerPlacement,
    returnFocus: placementRefs.current.get(placementId) || null,
    total: placements.length,
  };
}
