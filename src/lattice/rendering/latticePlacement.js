import {
  TRANSPARENCY_MODES,
  orderedTablePlacements,
} from '../domain/latticeProfile.js';
import {
  fitNativeMediaRectangle,
  projectPlacementRectangle,
} from './latticeGeometry.js';

export function resolvedTransparencyMode(mode) {
  return mode === TRANSPARENCY_MODES.OPAQUE
    ? TRANSPARENCY_MODES.OPAQUE
    : TRANSPARENCY_MODES.PRESERVE_ALPHA;
}

export function projectTableMediaPlacements({
  artboard,
  assetsByStableId,
  framing,
  table,
  viewport,
}) {
  return orderedTablePlacements(table).flatMap((placement) => {
    const media = assetsByStableId?.[placement.stableAssetId];
    if (!media) return [];
    const footprint = projectPlacementRectangle(placement, artboard, viewport, framing);
    return [{
      media,
      mediaRectangle: fitNativeMediaRectangle(footprint, media),
      placement,
      tableId: table.id,
      transparencyMode: resolvedTransparencyMode(placement.transparencyMode),
    }];
  });
}
