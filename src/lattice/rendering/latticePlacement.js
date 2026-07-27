import {
  TRANSPARENCY_MODES,
  orderedTablePlacements,
} from '../domain/latticeProfile.js';
import {
  fitNativeMediaRectangle,
  projectPlacementRectangle,
} from './latticeGeometry.js';
import { projectCroppedMediaRectangle } from './latticeCrop.js';

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
    const cropped = placement.crop != null;
    const mediaRectangle = cropped ? footprint : fitNativeMediaRectangle(footprint, media);
    return [{
      cropped,
      imageRectangle: cropped
        ? projectCroppedMediaRectangle(mediaRectangle, media, placement.crop)
        : mediaRectangle,
      media,
      mediaRectangle,
      placement,
      tableId: table.id,
      transparencyMode: resolvedTransparencyMode(placement.transparencyMode),
    }];
  });
}
