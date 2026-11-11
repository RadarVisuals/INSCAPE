import { fitNativeMediaRectangle } from './latticeGeometry.js';
import { projectCroppedMediaRectangle } from './latticeCrop.js';

// A free resize retains the original fitting frame, then scales that image
// into the new opening. This preserves transparent margins and crop focus.
export function placementMediaRectangle(opening, dimensions, crop, mediaFrameRatio) {
  const reference = mediaFrameRatio === undefined ? opening
    : { ...opening, width: opening.height * mediaFrameRatio };
  const fitted = crop ? projectCroppedMediaRectangle(reference, dimensions, crop)
    : fitNativeMediaRectangle(reference, dimensions);
  if (mediaFrameRatio === undefined) return fitted;
  const scaleX = opening.width / reference.width;
  return { ...fitted, left: opening.left + (fitted.left - reference.left) * scaleX,
    width: fitted.width * scaleX };
}
