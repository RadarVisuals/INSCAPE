import { useEffect, useRef, useState } from 'react';
import { projectSystemWorkflowTransform, projectSystemWorkflowImageRenderRectangle } from '../systemWorkflow/systemWorkflowTransform.js';
import { projectCroppedMediaRectangle } from '../lattice/rendering/latticeCrop.js';
import { fitNativeMediaRectangle } from '../lattice/rendering/latticeGeometry.js';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
import { useArtworkMediaType } from '../artwork/useSvgArtwork.js';
import ProjectedSvgArtwork from '../artwork/ProjectedSvgArtwork.jsx';

// One SVG viewport owns projection and clipping, in canvas coordinates.
export default function ImageArtwork({ side, rectangle, crop = side.crop, onReady, onError }) {
  const media = side.asset.media;
  const src = resolvePublishedAssetUrl(media.url);
  const { svg, pending } = useArtworkMediaType(src);
  const [loadState, setLoadState] = useState({ src, status: 'loading', show: false });
  const callbacks = useRef(null); callbacks.current = { onReady, onError };
  useEffect(() => {
    if (pending || svg) return undefined;
    let active = true;
    setLoadState({ src, status: 'loading', show: false });
    const image = new Image(); image.decoding = 'async'; image.src = src;
    // Loading an SVG <image> is not proof that its bitmap has been decoded.
    // Both the initial and incoming side own a bounded decoder. Promotion of
    // a prepared side retains its ready state and DOM, rather than loading again.
    const loading = setTimeout(() => { if (active) setLoadState({ src, status: 'loading', show: true }); }, 180);
    const finish = status => {
      if (!active) return;
      active = false; clearTimeout(loading); clearTimeout(timeout);
      setLoadState({ src, status, show: true });
      if (status === 'ready') callbacks.current.onReady?.();
      else { image.removeAttribute('src'); callbacks.current.onError?.(); }
    };
    const timeout = setTimeout(() => finish('failed'), 15000);
    image.decode().then(() => finish('ready')).catch(() => finish('failed'));
    return () => { active = false; clearTimeout(loading); clearTimeout(timeout); image.removeAttribute('src'); };
  }, [src, pending, svg]);
  const status = loadState.src === src ? loadState.status : 'loading';
  const projection = projectSystemWorkflowTransform(side.transform, media, crop);
  const { quarterTurns, mirrorX, mirrorY } = side.transform;
  const fitted = crop ? projectCroppedMediaRectangle(rectangle, projection.dimensions, projection.crop)
    : fitNativeMediaRectangle(rectangle, projection.dimensions);
  const image = projectSystemWorkflowImageRenderRectangle(fitted, projection);
  if (svg) return <ProjectedSvgArtwork src={src} width={rectangle.width} height={rectangle.height}
    dimensions={media} mediaStyle={{ ...image, transform: projection.css }} onReady={onReady} />;
  return <><svg className="image-module__artwork" data-media-state={status} viewBox={`0 0 ${rectangle.width} ${rectangle.height}`} preserveAspectRatio="none" aria-hidden="true">
    <image href={resolvePublishedAssetUrl(media.url)} x={image.left} y={image.top} width={image.width} height={image.height}
      preserveAspectRatio="none" transform={`translate(${fitted.left + fitted.width / 2} ${fitted.top + fitted.height / 2}) scale(${mirrorX ? -1 : 1} ${mirrorY ? -1 : 1}) rotate(${quarterTurns * 90}) translate(${-image.left - image.width / 2} ${-image.top - image.height / 2})`} />
  </svg>
    {!onReady && status !== 'ready' && loadState.src === src && loadState.show
      && <span className="image-module__flip-status" role="status">{status === 'failed'
        ? 'Artwork unavailable. Close and reopen Image to retry.' : 'Loading artwork…'}</span>}
  </>;
}
