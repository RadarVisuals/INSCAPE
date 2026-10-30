// Pointer drag, native drop and double-click must retain the same chosen image.
export function systemWorkflowPlacementRequest(asset, dimensions, gridId, destination = null) {
  return {
    gridId,
    stableAssetId: asset.stableAssetId || asset.id,
    ...(asset.selectedMedia ? { selectedMedia: {
      url: dimensions.source || asset.selectedMedia.url,
      width: dimensions.width,
      height: dimensions.height,
    } } : {}),
    nativeWidth: dimensions.width,
    nativeHeight: dimensions.height,
    ...(destination ? { destination } : {}),
  };
}
