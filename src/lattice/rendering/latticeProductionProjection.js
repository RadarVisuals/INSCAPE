import { placementMediaRectangle } from './placementMediaRectangle.js';
import { projectSystemWorkflowTransform } from '../../systemWorkflow/systemWorkflowTransform.js';
import { projectSystemWorkflowPlacement as projectLatticeProductionPlacement } from '../../systemWorkflow/systemWorkflowViewportProjection.js';
export { projectLatticeProductionPlacement };
import { projectLatticePixelRectangle, projectLatticeRasterBleedRectangle } from './latticePixelGeometry.js';
import { projectDisplayPlacementRectangle } from './displayPaintGeometry.js';

export function projectArtworkInRectangle(placement, footprint, mediaDimensions, pixelSnapped = false) {
  if (!mediaDimensions) return Object.freeze({
    footprint,
    mediaOpeningRectangle: footprint,
    imageRectangle: null,
    imageRenderRectangle: null,
    imageTransform: 'none',
  });
  const transformed = projectSystemWorkflowTransform(placement.transform, mediaDimensions, placement.crop);
  // Fit against authored cell proportions, before rounded screen dimensions
  // can change the aspect ratio and manufacture a native-fit letterbox.
  const reference = pixelSnapped ? footprint
    : { left: 0, top: 0, width: placement.columnSpan ?? footprint.width, height: placement.rowSpan ?? footprint.height };
  const fitted = placementMediaRectangle(reference, transformed.dimensions, transformed.crop, placement.mediaFrameRatio);
  const imageRectangle = pixelSnapped ? fitted : {
    left: footprint.left + fitted.left / reference.width * footprint.width,
    top: footprint.top + fitted.top / reference.height * footprint.height,
    width: fitted.width / reference.width * footprint.width,
    height: fitted.height / reference.height * footprint.height,
  };
  // Continuous Display geometry already shares exact placement/media edges.
  // A fixed-pixel enlargement here changes its relative crop when a scaled
  // animation hands back to layout. Only the pixel-snapped projection needs
  // compensation for independently rounded native-ratio edges.
  const rasterRectangle = pixelSnapped ? projectLatticeRasterBleedRectangle(imageRectangle, footprint) : imageRectangle;
  const imageRenderRectangle = transformed.swapped ? {
    left: rasterRectangle.left + ((rasterRectangle.width - rasterRectangle.height) / 2),
    top: rasterRectangle.top + ((rasterRectangle.height - rasterRectangle.width) / 2),
    width: rasterRectangle.height,
    height: rasterRectangle.width,
  } : rasterRectangle;
  return Object.freeze({
    footprint,
    mediaOpeningRectangle: footprint,
    imageRectangle: Object.freeze(imageRectangle),
    imageRenderRectangle: Object.freeze(imageRenderRectangle),
    imageTransform: transformed.css,
  });
}

export function projectLatticeProductionArtwork(placement, field, mediaDimensions, displayScale) {
  return projectArtworkInRectangle(placement, displayScale === undefined
    ? projectLatticeProductionPlacement(placement, field)
    : projectDisplayPlacementRectangle(placement, field, displayScale), mediaDimensions);
}

export function projectLatticeProductionPixelArtwork(placement, field, mediaDimensions) {
  return projectArtworkInRectangle(placement, projectLatticePixelRectangle(placement, field), mediaDimensions, true);
}
