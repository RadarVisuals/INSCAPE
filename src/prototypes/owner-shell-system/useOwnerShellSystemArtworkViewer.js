import { useEffect, useRef, useState } from 'react';

export const createOwnerShellSystemViewerEntry = ({ asset, placement }) => asset && placement ? ({
  accessibleLabel: asset.title,
  dossier: {
    title: asset.title,
    description: 'A focused artwork presentation. Narrative and creator context appear before technical metadata.',
    traits: [
      { label: 'COLLECTION', value: asset.collection },
      { label: 'FORMAT', value: `${asset.width} × ${asset.height}` },
      { label: 'MEDIA', value: asset.mediaType.toUpperCase() },
    ],
    technical: [
      { label: 'CREATOR', value: 'RADAR VISUALS' },
      { label: 'STANDARD', value: 'LSP8' },
      { label: 'NETWORK', value: 'LUKSO / 42' },
      { label: 'ASSET ID', value: asset.stableAssetId },
    ],
  },
  focusDimensions: { height: asset.height, width: asset.width },
  media: { accessibleLabel: asset.title, src: asset.src },
  placement: {
    backing: { enabled: false, color: '#d8d4ca' },
    column: 0,
    columnSpan: placement.width / 100,
    crop: placement.crop,
    id: placement.id,
    mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
    row: 0,
    rowSpan: placement.height / 100,
    transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
    transparencyMode: 'AUTO',
  },
}) : null;

export default function useOwnerShellSystemArtworkViewer({ activePlacements, assets, onOpen, replaceSelection }) {
  const [placementId, setPlacementId] = useState(null);
  const [originRectangle, setOriginRectangle] = useState(null);
  const placementRefs = useRef(new Map());
  const index = activePlacements.findIndex(({ id }) => id === placementId);
  const placement = index >= 0 ? activePlacements[index] : null;
  const asset = placement ? assets.find(({ stableAssetId }) => stableAssetId === placement.assetId) : null;
  const entry = createOwnerShellSystemViewerEntry({ asset, placement });

  const registerPlacement = (id, node) => {
    if (node) placementRefs.current.set(id, node);
    else placementRefs.current.delete(id);
  };
  const close = () => {
    setPlacementId(null);
    setOriginRectangle(null);
  };
  const open = async (id) => {
    const source = placementRefs.current.get(id);
    const nextPlacement = activePlacements.find((candidate) => candidate.id === id);
    const nextAsset = assets.find(({ stableAssetId }) => stableAssetId === nextPlacement?.assetId);
    if (!source || !nextAsset) return false;
    const rectangle = source.getBoundingClientRect();
    const nativeImage = new Image();
    nativeImage.decoding = 'async';
    nativeImage.src = nextAsset.src;
    try { await nativeImage.decode(); } catch { /* The viewer retains its media fallback if decoding fails. */ }
    if (!source.isConnected) return false;
    setOriginRectangle({
      bottom: rectangle.bottom,
      height: rectangle.height,
      left: rectangle.left,
      right: rectangle.right,
      top: rectangle.top,
      width: rectangle.width,
    });
    replaceSelection([id], id);
    setPlacementId(id);
    onOpen?.();
    return true;
  };
  const navigate = (direction) => {
    if (!activePlacements.length || index < 0) return;
    const nextIndex = (index + direction + activePlacements.length) % activePlacements.length;
    const nextId = activePlacements[nextIndex].id;
    setPlacementId(nextId);
    replaceSelection([nextId], nextId);
  };

  useEffect(() => {
    if (placementId && index < 0) close();
  }, [index, placementId]);

  return {
    close,
    entry,
    getReturnRectangle: () => placementRefs.current.get(placementId)?.getBoundingClientRect() || originRectangle,
    navigate,
    open,
    originRectangle,
    placementId,
    position: index,
    registerPlacement,
    returnFocus: placementRefs.current.get(placementId) || null,
    total: activePlacements.length,
  };
}
