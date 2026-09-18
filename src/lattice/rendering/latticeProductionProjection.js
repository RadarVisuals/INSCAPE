import { placementMediaRectangle } from './placementMediaRectangle.js';
import { projectArtworkMat } from './latticeMat.js';
import { projectSystemWorkflowTransform } from '../../systemWorkflow/systemWorkflowTransform.js';
import { projectSystemWorkflowPlacement as projectLatticeProductionPlacement } from '../../systemWorkflow/systemWorkflowViewportProjection.js';
export { projectLatticeProductionPlacement };
import { projectLatticePixelRectangle, projectLatticeRasterBleedRectangle } from './latticePixelGeometry.js';

function projectArtwork(placement, field, mediaDimensions, projectPlacement) {
  const footprint = projectPlacement(placement, field);
  const mat = projectArtworkMat(footprint, placement.mat);
  if (!mediaDimensions) return Object.freeze({
    footprint,
    mat: mat.mat,
    backplateRectangle: mat.backplateRectangle,
    mediaOpeningRectangle: mat.mediaOpeningRectangle,
    imageRectangle: null,
    imageRenderRectangle: null,
    imageTransform: 'none',
  });
  const transformed = projectSystemWorkflowTransform(placement.transform, mediaDimensions, placement.crop);
  const imageRectangle = placementMediaRectangle(mat.mediaOpeningRectangle, transformed.dimensions, transformed.crop,
    placement.mediaFrameRatio === undefined ? undefined : placement.mediaFrameRatio
      * (mat.mediaOpeningRectangle.width / footprint.width) / (mat.mediaOpeningRectangle.height / footprint.height));
  const rasterRectangle = projectLatticeRasterBleedRectangle(imageRectangle, mat.mediaOpeningRectangle);
  const imageRenderRectangle = transformed.swapped ? {
    left: rasterRectangle.left + ((rasterRectangle.width - rasterRectangle.height) / 2),
    top: rasterRectangle.top + ((rasterRectangle.height - rasterRectangle.width) / 2),
    width: rasterRectangle.height,
    height: rasterRectangle.width,
  } : rasterRectangle;
  return Object.freeze({
    footprint,
    mat: mat.mat,
    backplateRectangle: mat.backplateRectangle,
    mediaOpeningRectangle: mat.mediaOpeningRectangle,
    imageRectangle: Object.freeze(imageRectangle),
    imageRenderRectangle: Object.freeze(imageRenderRectangle),
    imageTransform: transformed.css,
  });
}

export function projectLatticeProductionArtwork(placement, field, mediaDimensions) {
  return projectArtwork(placement, field, mediaDimensions, projectLatticeProductionPlacement);
}

export function projectLatticeProductionPixelArtwork(placement, field, mediaDimensions) {
  return projectArtwork(placement, field, mediaDimensions, projectLatticePixelRectangle);
}
