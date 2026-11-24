import { memo, useState } from 'react';
import ShapeSurface from '../../shapes/ShapeSurface.jsx';
import { resolvePublishedAssetUrl } from '../../profileDocument/domain/publishedAssetUrl.js';
import { projectSystemWorkflowTransform, projectSystemWorkflowImageRenderRectangle } from '../../systemWorkflow/systemWorkflowTransform.js';
import { projectCroppedMediaRectangle } from '../../lattice/rendering/latticeCrop.js';
import { fitNativeMediaRectangle } from '../../lattice/rendering/latticeGeometry.js';
import ArticleView from '../../text/ArticleView.jsx';
import { articleFlowSlice } from '../../text/articleFlow.js';
import { textWindowStyle, textOutputStyle } from '../../text/domain/article.js';

const sameGeometry = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function ImageMiniature({ source, width, height }) {
  const artwork = source.artwork, media = artwork?.asset?.media;
  const [failed, setFailed] = useState(null);
  if (!media || failed === media.url) return <div className="navigator-media-missing"><span>Image</span></div>;
  const projection = projectSystemWorkflowTransform(artwork.transform, media, source.crop);
  const rectangle = { left: 0, top: 0, width, height };
  const fitted = source.crop ? projectCroppedMediaRectangle(rectangle, projection.dimensions, projection.crop) : fitNativeMediaRectangle(rectangle, projection.dimensions);
  const image = projectSystemWorkflowImageRenderRectangle(fitted, projection);
  return <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"><image href={resolvePublishedAssetUrl(media.url)}
    x={image.left} y={image.top} width={image.width} height={image.height} preserveAspectRatio="none" onError={() => setFailed(media.url)}
    transform={`translate(${fitted.left + fitted.width / 2} ${fitted.top + fitted.height / 2}) scale(${artwork.transform.mirrorX ? -1 : 1} ${artwork.transform.mirrorY ? -1 : 1}) rotate(${artwork.transform.quarterTurns * 90}) translate(${-image.left - image.width / 2} ${-image.top - image.height / 2})`} /></svg>;
}
export default memo(function WorkbenchMiniature({ item, paint }) {
  const { source, id, scale = 1 } = item;
  const frame = { ...item.frame, width: item.frame.width / scale, height: item.frame.height / scale };
  let content;
  if (source?.kind === 'image') content = <ImageMiniature source={source} width={frame.width} height={frame.height} />;
  else if (source?.kind === 'shape') content = <ShapeSurface record={source.record} radius={source.radius} />;
  else if (source?.kind === 'text') {
    const { article, range, index } = source;
    const flow = range ? { ...articleFlowSlice(article.content, range.from, range.to), title: !index } : undefined;
    content = <div className="text-module-body" style={{ ...textWindowStyle(article), ...textOutputStyle(article, frame),
      '--workbench-content-scale': 1, '--workbench-content-width': `${frame.width}px`, '--workbench-paint-width': `${frame.width}px`, '--workbench-paint-height': `${frame.height}px` }}><ArticleView article={article} flow={flow} /></div>;
  } else content = <span>{source?.name || item.name || 'Content'}</span>;
  return <div data-navigator-object={id} className={`navigator-object${source ? '' : ' navigator-object--missing'}`} style={{ ...item.frame, ...paint, '--workbench-content-scale': 1, '--workbench-density': 1 }}>
    <div className="navigator-object-content" style={{ width: paint?.width ?? frame.width, height: paint?.height ?? frame.height, transform: paint ? undefined : `scale(${scale})` }}>{content}</div></div>;
}, (a, b) => a.item.source === b.item.source && a.item.scale === b.item.scale && sameGeometry(a.item.frame, b.item.frame) && a.item.name === b.item.name && sameGeometry(a.paint, b.paint));
