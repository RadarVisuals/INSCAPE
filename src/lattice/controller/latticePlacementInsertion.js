import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';
import {
  FRAME_IDS,
  TRANSPARENCY_MODES,
} from '../domain/latticeProfile.js';

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const DEFAULT_LATTICE_INSERTION_CONFIG = Object.freeze({ preferredWidth: 0.22 });

function requireProjectedArtboard(rectangle) {
  if (!rectangle
    || !Number.isFinite(rectangle.left) || !Number.isFinite(rectangle.top)
    || !Number.isFinite(rectangle.width) || rectangle.width <= 0
    || !Number.isFinite(rectangle.height) || rectangle.height <= 0) {
    throw new TypeError('Placement insertion requires a projected artboard rectangle');
  }
  return rectangle;
}

export function normalizedInsertionAnchor(point, projectedArtboard) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError('Placement insertion requires a finite pointer point');
  }
  const artboard = requireProjectedArtboard(projectedArtboard);
  return {
    x: clamp((point.x - artboard.left) / artboard.width, 0, 1),
    y: clamp((point.y - artboard.top) / artboard.height, 0, 1),
  };
}

export function createPlacementAtAnchor({
  anchor,
  artboard,
  media,
  placementId,
  placements,
  preferredWidth = DEFAULT_LATTICE_INSERTION_CONFIG.preferredWidth,
  stableAssetId,
}) {
  if (!Array.isArray(placements)) throw new TypeError('Placement insertion requires a placement array');
  if (typeof placementId !== 'string' || !placementId || placements.some(({ id }) => id === placementId)) {
    throw new TypeError('Placement insertion requires a unique placement ID');
  }
  if (!parseCanonicalAssetId(stableAssetId)) {
    throw new TypeError('Placement insertion requires a canonical stable asset ID');
  }
  if (!anchor || !Number.isFinite(anchor.x) || anchor.x < 0 || anchor.x > 1
    || !Number.isFinite(anchor.y) || anchor.y < 0 || anchor.y > 1) {
    throw new TypeError('Placement insertion requires a normalized anchor');
  }
  if (!artboard || !Number.isFinite(artboard.aspectWidth) || artboard.aspectWidth <= 0
    || !Number.isFinite(artboard.aspectHeight) || artboard.aspectHeight <= 0
    || !media || !Number.isFinite(media.width) || media.width <= 0
    || !Number.isFinite(media.height) || media.height <= 0
    || !Number.isFinite(preferredWidth) || preferredWidth <= 0 || preferredWidth > 1) {
    throw new TypeError('Placement insertion requires valid ratio geometry');
  }
  let width = preferredWidth;
  let height = width * (artboard.aspectWidth / artboard.aspectHeight) * (media.height / media.width);
  const fitScale = Math.min(1, 1 / width, 1 / height);
  width *= fitScale;
  height *= fitScale;
  const maximumLayer = placements.reduce((maximum, placement) => Math.max(maximum, placement.layer), -1);
  const maximumNavigationOrder = placements.reduce(
    (maximum, placement) => Math.max(maximum, placement.navigationOrder),
    -1,
  );
  return {
    id: placementId,
    stableAssetId,
    x: clamp(anchor.x - (width / 2), 0, 1 - width),
    y: clamp(anchor.y - (height / 2), 0, 1 - height),
    width,
    height,
    layer: maximumLayer + 1,
    navigationOrder: maximumNavigationOrder + 1,
    crop: null,
    frameId: FRAME_IDS.NONE,
    transparencyMode: TRANSPARENCY_MODES.AUTO,
    visitorVisible: true,
  };
}
