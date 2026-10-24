import { focusedViewerRectangle, focusViewerPresentationDimensions } from '../../lattice/rendering/latticeFocusViewer.js';

// The artwork and its inspection controls share the same fitted destination.
export function displayLiftRectangle(entry, viewport) {
  return focusedViewerRectangle({ left: 0, top: 0, ...focusViewerPresentationDimensions(entry) }, viewport,
    { horizontalMargin: Math.min(32, viewport.width * .04),
      verticalMargin: Math.min(32, viewport.height * .04), verticalArtworkScale: 1 });
}
