import { memo, useId, useState } from 'react';
import { resolvePublishedAssetUrl } from '../../profileDocument/domain/publishedAssetUrl.js';
import { projectSystemWorkflowTransform, projectSystemWorkflowImageRenderRectangle } from '../../systemWorkflow/systemWorkflowTransform.js';
import { projectCroppedMediaRectangle } from '../../lattice/rendering/latticeCrop.js';
import { fitNativeMediaRectangle } from '../../lattice/rendering/latticeGeometry.js';
import ArticleView from '../../text/ArticleView.jsx';
import { articleFlowSlice } from '../../text/articleFlow.js';
import { textWindowStyle, textOutputStyle } from '../../text/domain/article.js';
import { projectArtworkInRectangle } from '../../lattice/rendering/latticeProductionProjection.js';
import { projectSystemWorkflowViewport, projectSystemWorkflowPlacement } from '../../systemWorkflow/systemWorkflowViewportProjection.js';
import { latticeSurfaceColor } from '../../lattice/rendering/latticeGeometry.js';

const sameGeometry = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function ImageMiniature({ source, width, height }) {
  const side = source.side, media = side?.asset?.media;
  const [failed, setFailed] = useState(null);
  if (!media || failed === media.url) return <div className="navigator-media-missing"><span>Image</span></div>;
  const projection = projectSystemWorkflowTransform(side.transform, media, source.crop);
  const rectangle = { left: 0, top: 0, width, height };
  const fitted = source.crop ? projectCroppedMediaRectangle(rectangle, projection.dimensions, projection.crop) : fitNativeMediaRectangle(rectangle, projection.dimensions);
  const image = projectSystemWorkflowImageRenderRectangle(fitted, projection);
  return <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"><image href={resolvePublishedAssetUrl(media.url)}
    x={image.left} y={image.top} width={image.width} height={image.height} preserveAspectRatio="none" onError={() => setFailed(media.url)}
    transform={`translate(${fitted.left + fitted.width / 2} ${fitted.top + fitted.height / 2}) scale(${side.transform.mirrorX ? -1 : 1} ${side.transform.mirrorY ? -1 : 1}) rotate(${side.transform.quarterTurns * 90}) translate(${-image.left - image.width / 2} ${-image.top - image.height / 2})`} /></svg>;
}
function ShapeMiniature({ record }) {
  const id = useId().replace(/:/g, '');
  const style = { position: 'absolute', inset: 0, backgroundColor: record.color, opacity: record.opacity, filter: record.blur ? `blur(${record.blur}px)` : undefined };
  if (record.kind === 'grid') return <svg style={{ opacity: record.opacity }}><defs><pattern id={id} patternUnits="userSpaceOnUse" width={record.grid.spacing} height={record.grid.spacing}>
    <path d={`M0,${record.grid.spacing}V0H${record.grid.spacing}`} fill="none" stroke={record.color} strokeWidth={record.grid.lineWidth * 2} /></pattern></defs><rect width="100%" height="100%" fill={`url(#${id})`} /></svg>;
  if (record.kind === 'texture') Object.assign(style, { maskImage: "url('/assets/noise-samples/grain-mono.png')", maskMode: 'luminance', maskSize: `${128 * record.texture.scale}px` });
  return <div style={style}>{record.grain > 0 && <span className="module-surface-grain" style={{ '--module-grain': record.grain * .3 }} />}</div>;
}
function DisplayMiniature({ source, frame }) {
  if (!source.geometry) return null;
  const field = projectSystemWorkflowViewport(source.geometry, frame);
  return <div style={{ position: 'absolute', inset: 0, background: source.appearance?.backgroundColor || latticeSurfaceColor(source.appearance?.surfaceId) }}>
    {(source.grid?.placements || []).filter(p => !source.hidden?.has(p.id)).map(placement => {
      const rectangle = projectSystemWorkflowPlacement(placement, field);
      if (placement.kind === 'text') return <div key={placement.id} style={{ position: 'absolute', ...rectangle, overflow: 'hidden' }}><ArticleView article={placement.article} /></div>;
      const asset = placement.asset || source.assets?.get(placement.stableAssetId), media = asset?.media || asset && {
        url: asset.previewSrc || asset.thumbnailUrl || asset.src || asset.imageUrl,
        width: asset.imageWidth || asset.width, height: asset.imageHeight || asset.height,
      };
      if (!media?.url || !media.width || !media.height) return <div key={placement.id} className="navigator-object--missing" style={{ position: 'absolute', ...rectangle }} />;
      const projection = projectArtworkInRectangle(placement, { left: 0, top: 0, width: rectangle.width, height: rectangle.height }, media);
      const image = projection.imageRenderRectangle;
      return <div key={placement.id} style={{ position: 'absolute', ...rectangle, overflow: 'hidden' }}>
        <img alt="" draggable={false} src={media.url.startsWith('/') ? media.url : resolvePublishedAssetUrl(media.url)}
          style={{ position: 'absolute', ...image, maxWidth: 'none', transform: projection.imageTransform }} />
      </div>;
    })}
  </div>;
}
export default memo(function WorkbenchMiniature({ item, paint }) {
  const { source, id, scale = 1 } = item;
  const frame = { ...item.frame, width: item.frame.width / scale, height: item.frame.height / scale };
  let content;
  if (source?.kind === 'image') content = <ImageMiniature source={source} width={frame.width} height={frame.height} />;
  else if (source?.kind === 'shape') content = <ShapeMiniature record={source.record} />;
  else if (source?.kind === 'display') content = <DisplayMiniature source={source} frame={frame} />;
  else if (source?.kind === 'text') {
    const { article, range, index } = source;
    const flow = range ? { ...articleFlowSlice(article.content, range.from, range.to), title: !index } : undefined;
    content = <div className="text-module-body" style={{ ...textWindowStyle(article), ...textOutputStyle(article, frame),
      '--workbench-content-scale': 1, '--workbench-content-width': `${frame.width}px`, '--workbench-paint-width': `${frame.width}px`, '--workbench-paint-height': `${frame.height}px` }}><ArticleView article={article} flow={flow} /></div>;
  } else content = <span>{source?.name || item.name || 'Content'}</span>;
  return <div data-navigator-object={id} className={`navigator-object${source ? '' : ' navigator-object--missing'}`} style={{ ...item.frame, ...paint, '--workbench-content-scale': 1, '--workbench-density': 1 }}>
    <div className="navigator-object-content" style={{ width: paint?.width ?? frame.width, height: paint?.height ?? frame.height, transform: paint ? undefined : `scale(${scale})` }}>{content}</div></div>;
}, (a, b) => a.item.source === b.item.source && a.item.scale === b.item.scale && sameGeometry(a.item.frame, b.item.frame) && a.item.name === b.item.name && sameGeometry(a.paint, b.paint));
