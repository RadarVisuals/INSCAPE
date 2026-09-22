import { placementMediaRectangle } from './placementMediaRectangle.js';
import { projectSystemWorkflowTransform } from '../../systemWorkflow/systemWorkflowTransform.js';
import { projectSystemWorkflowPlacement as projectLatticeProductionPlacement } from '../../systemWorkflow/systemWorkflowViewportProjection.js';
export { projectLatticeProductionPlacement };
import { projectLatticePixelRectangle, projectLatticeRasterBleedRectangle } from './latticePixelGeometry.js';

export function projectArtworkInRectangle(placement, footprint, mediaDimensions) {
  if (!mediaDimensions) return Object.freeze({
    footprint,
    mediaOpeningRectangle: footprint,
    imageRectangle: null,
    imageRenderRectangle: null,
    imageTransform: 'none',
  });
  const transformed = projectSystemWorkflowTransform(placement.transform, mediaDimensions, placement.crop);
  const imageRectangle = placementMediaRectangle(footprint, transformed.dimensions, transformed.crop, placement.mediaFrameRatio);
  const rasterRectangle = projectLatticeRasterBleedRectangle(imageRectangle, footprint);
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

export function projectLatticeProductionArtwork(placement, field, mediaDimensions) {
  return projectArtworkInRectangle(placement, projectLatticeProductionPlacement(placement, field), mediaDimensions);
}

export function projectLatticeProductionPixelArtwork(placement, field, mediaDimensions) {
  return projectArtworkInRectangle(placement, projectLatticePixelRectangle(placement, field), mediaDimensions);
}
