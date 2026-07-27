import { normalizeArtworkMat, projectArtworkMat } from '../rendering/latticeMat.js';

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function reframePlacementForMat(placementRectangle, artboardRectangle, currentValue, nextValue) {
  if (!artboardRectangle
    || !Number.isFinite(artboardRectangle.width) || artboardRectangle.width <= 0
    || !Number.isFinite(artboardRectangle.height) || artboardRectangle.height <= 0) {
    throw new TypeError('Artwork mat reframing requires a positive projected artboard');
  }
  const current = projectArtworkMat(placementRectangle, currentValue);
  const next = normalizeArtworkMat(nextValue);
  const widthFraction = next.enabled ? 1 - next.inset.left - next.inset.right : 1;
  const heightFraction = next.enabled ? 1 - next.inset.top - next.inset.bottom : 1;
  let width = current.mediaOpeningRectangle.width / widthFraction;
  let height = current.mediaOpeningRectangle.height / heightFraction;
  const scale = Math.min(1, artboardRectangle.width / width, artboardRectangle.height / height);
  width *= scale;
  height *= scale;
  const desiredLeft = current.mediaOpeningRectangle.left - (width * (next.enabled ? next.inset.left : 0));
  const desiredTop = current.mediaOpeningRectangle.top - (height * (next.enabled ? next.inset.top : 0));
  const left = clamp(desiredLeft, artboardRectangle.left, artboardRectangle.left + artboardRectangle.width - width);
  const top = clamp(desiredTop, artboardRectangle.top, artboardRectangle.top + artboardRectangle.height - height);
  return {
    x: (left - artboardRectangle.left) / artboardRectangle.width,
    y: (top - artboardRectangle.top) / artboardRectangle.height,
    width: width / artboardRectangle.width,
    height: height / artboardRectangle.height,
  };
}
