import { projectCroppedMediaRectangle } from './latticeCrop.js';
import { projectArtworkMat } from './latticeMat.js';
import { projectSystemWorkflowTransform } from '../../systemWorkflow/systemWorkflowTransform.js';
import { projectLatticePixelRectangle, projectLatticeRasterBleedRectangle } from './latticePixelGeometry.js';

function fitNativeMediaRectangle(rectangle, media) {
  if (!media || !Number.isFinite(media.width) || media.width <= 0
    || !Number.isFinite(media.height) || media.height <= 0) {
    throw new TypeError('Production media fitting requires positive native dimensions');
  }
  const scale = Math.min(rectangle.width / media.width, rectangle.height / media.height);
  const width = media.width * scale;
  const height = media.height * scale;
  return {
    left: rectangle.left + ((rectangle.width - width) / 2),
    top: rectangle.top + ((rectangle.height - height) / 2),
    width,
    height,
  };
}

export function projectLatticeProductionPlacement(placement, field) {
  return Object.freeze({
    left: field.left + (placement.column * field.cellSize),
    top: field.top + (placement.row * field.cellSize),
    width: placement.columnSpan * field.cellSize,
    height: placement.rowSpan * field.cellSize,
  });
}

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
  const imageRectangle = transformed.crop
    ? projectCroppedMediaRectangle(mat.mediaOpeningRectangle, transformed.dimensions, transformed.crop)
    : fitNativeMediaRectangle(mat.mediaOpeningRectangle, transformed.dimensions);
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
