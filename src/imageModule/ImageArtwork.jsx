import { projectSystemWorkflowTransform, projectSystemWorkflowImageRenderRectangle } from '../systemWorkflow/systemWorkflowTransform.js';
import { projectCroppedMediaRectangle } from '../lattice/rendering/latticeCrop.js';
import { fitNativeMediaRectangle } from '../lattice/rendering/latticeGeometry.js';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
import useSvgArtwork from '../artwork/useSvgArtwork.js';
import ProjectedSvgArtwork from '../artwork/ProjectedSvgArtwork.jsx';

// One SVG viewport owns projection and clipping, in canvas coordinates.
export default function ImageArtwork({ side, rectangle, crop = side.crop }) {
  const media = side.asset.media;
  const src = resolvePublishedAssetUrl(media.url);
  const svg = useSvgArtwork(src);
  const projection = projectSystemWorkflowTransform(side.transform, media, crop);
  const { quarterTurns, mirrorX, mirrorY } = side.transform;
  const fitted = crop ? projectCroppedMediaRectangle(rectangle, projection.dimensions, projection.crop)
    : fitNativeMediaRectangle(rectangle, projection.dimensions);
  const image = projectSystemWorkflowImageRenderRectangle(fitted, projection);
  if (svg) return <ProjectedSvgArtwork src={src} width={rectangle.width} height={rectangle.height}
    dimensions={media} mediaStyle={{ ...image, transform: projection.css }} />;
  return <svg className="image-module__artwork" viewBox={`0 0 ${rectangle.width} ${rectangle.height}`} preserveAspectRatio="none" aria-hidden="true">
    <image href={resolvePublishedAssetUrl(media.url)} x={image.left} y={image.top} width={image.width} height={image.height}
      preserveAspectRatio="none" transform={`translate(${fitted.left + fitted.width / 2} ${fitted.top + fitted.height / 2}) scale(${mirrorX ? -1 : 1} ${mirrorY ? -1 : 1}) rotate(${quarterTurns * 90}) translate(${-image.left - image.width / 2} ${-image.top - image.height / 2})`} />
  </svg>;
}
