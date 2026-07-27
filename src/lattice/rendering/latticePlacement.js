import {
  TRANSPARENCY_MODES,
  orderedTablePlacements,
} from '../domain/latticeProfile.js';
import {
  fitNativeMediaRectangle,
  projectPlacementRectangle,
} from './latticeGeometry.js';
import { projectCroppedMediaRectangle } from './latticeCrop.js';
import {
  DEFAULT_ARTWORK_BACKING,
  DEFAULT_ARTWORK_MAT,
  normalizeArtworkBacking,
  projectArtworkMat,
} from './latticeMat.js';

export function resolvedTransparencyMode(mode) {
  return mode === TRANSPARENCY_MODES.OPAQUE
    ? TRANSPARENCY_MODES.OPAQUE
    : TRANSPARENCY_MODES.PRESERVE_ALPHA;
}

export function projectTableMediaPlacements({
  artboard,
  artworkBackingsByPlacementId,
  artworkMatsByPlacementId,
  assetsByStableId,
  framing,
  table,
  viewport,
}) {
  return orderedTablePlacements(table).flatMap((placement) => {
    const media = assetsByStableId?.[placement.stableAssetId];
    if (!media) return [];
    const footprint = projectPlacementRectangle(placement, artboard, viewport, framing);
    const mat = projectArtworkMat(
      footprint,
      artworkMatsByPlacementId?.[placement.id] || DEFAULT_ARTWORK_MAT,
    );
    const cropped = placement.crop != null;
    const mediaRectangle = cropped
      ? mat.mediaOpeningRectangle
      : fitNativeMediaRectangle(mat.mediaOpeningRectangle, media);
    return [{
      backing: normalizeArtworkBacking(
        artworkBackingsByPlacementId?.[placement.id] || DEFAULT_ARTWORK_BACKING,
      ),
      backplateRectangle: mat.backplateRectangle,
      cropped,
      imageRectangle: cropped
        ? projectCroppedMediaRectangle(mediaRectangle, media, placement.crop)
        : mediaRectangle,
      mat: mat.mat,
      media,
      mediaRectangle,
      selectionRectangle: mat.backplateRectangle || mediaRectangle,
      placement,
      tableId: table.id,
      transparencyMode: resolvedTransparencyMode(placement.transparencyMode),
    }];
  });
}
